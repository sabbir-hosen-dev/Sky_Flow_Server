require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const nodemailer = require('nodemailer');

const port = process.env.PORT || 9000;
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://skyflow-277.web.app',
    'http://localhost:5174',
  ],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ikf6y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const secrectKey = process.env.SECRECT_KEY;

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  jwt.verify(token, secrectKey, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // await client.connect();
    const db = client.db('SkyFlow');
    const userCollection = db.collection('users');
    const apartmentCollection = db.collection('apartments');
    const agreementCollection = db.collection('agreements');
    const couponCollection = db.collection('coupons');
    const paymentCollection = db.collection('payments');
    const announcementsCollection = db.collection('announcements');
    // verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      // console.log('data from verifyToken middleware--->', req.user?.email)
      const email = req.user?.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      if (!result || result?.role !== 'admin')
        return res
          .status(403)
          .send({ message: 'Forbidden Access! Admin Only Actions!' });

      next();
    };

    const verifyMember = async (req, res, next) => {
      const email = req.user?.email;
      const query = { email };
      const result = await userCollection.findOne(query);

      if (!result || result?.role !== 'member') {
        return res
          .status(403)
          .send({ message: 'Forbidden Access! Admin Only Actions!' });
      }
      next();
    };

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    };

    //jwt set cookie
    app.post('/jwt', async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, secrectKey, { expiresIn: '1h' });

        res.cookie('token', token, cookieOptions);

        res.status(200).send({ message: 'jwt issued and cookie set' });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Error generating JWT token' });
      }
    });

    //logout
    app.post('/logout', (req, res) => {
      res
        .clearCookie('token', cookieOptions)
        .status(200)
        .json({ success: true, message: 'Logged out successfully' });
    });

    // user role set
    app.post('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };

      const user = req.body;
      const isExist = await userCollection.findOne(query);

      if (isExist) {
        return res.send(isExist);
      }

      const result = await userCollection.insertOne({
        ...user,
        role: 'user',
        timestamp: Date.now(),
      });
      res.send(result);
    });

    // user role Check
    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email: email });
      // console.log({ role: result.role });
      res.send({ role: result.role });
    });

    //admin delete a member
    app.patch(
      '/user/role-update/:id',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const email = req.query.email;

          const findAgreement = {
            email: email,
            status: 'approved',
          };
          const updateAgreement = await agreementCollection.updateOne(
            findAgreement,
            {
              $set: { status: 'rejected' },
            }
          );

          const result = await userCollection.updateOne(
            { _id: new ObjectId(id) }, // ✅ _id ফিল্ড ঠিক করা হয়েছে
            { $set: { role: 'user' } } // ✅ $set অপারেটর যোগ করা হয়েছে
          );
          res.send(result);
        } catch (error) {
          res.status(500).send({ error: 'Failed to update role' });
        }
      }
    );

    app.get('/memberData');

    //get all member
    app.get('/members', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find({ role: 'member' }).toArray();
      // console.log(result)
      res.send(result);
    });

    //get all agreement requests
    app.get(
      '/agreements/request',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await agreementCollection
          .find({ status: 'pending' })
          .toArray();
        res.send(result);
      }
    );

    // apartments collection to home page data get
    app.get('/apartments', async (req, res) => {
      const result = await apartmentCollection
        .find({})
        .sort({ createdAt: -1 })
        .project({
          images: { $arrayElemAt: ['$images', 0] },
          floorNo: 1,
          blockNo: 1,
          rent: 1,
          title: 1,
          _id: 1,
        })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // **Paginated Apartments Route**
    app.get('/allapartments', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        // Log received query parameters
        // console.log('Received Query Params:', req.query);

        const query = {};

        // Check and apply rent filters
        if (req.query.minRent) {
          query.price = { $gte: parseInt(req.query.minRent) };
        }
        if (req.query.maxRent) {
          query.price = { ...query.rent, $lte: parseInt(req.query.maxRent) };
        }

        // console.log('Applied Query Filter:', query);

        const total = await apartmentCollection.countDocuments(query);
        const apartments = await apartmentCollection
          .find(query)
          .skip(skip)
          .limit(limit)
          .project({
            images: { $arrayElemAt: ['$images', 0] },
            floorNo: 1,
            blockNo: 1,
            rent: 1,
            title: 1,
            _id: 1,
          })
          .toArray();

        res.json({
          total,
          page,
          totalPages: Math.ceil(total / limit),
          data: apartments,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
      }
    });

    // single apartment data get
    app.get('/apartments/:id', async (req, res) => {
      // console.log('hi');
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await apartmentCollection.findOne(query);
      res.send(result);
    });

    // appertment request to sotre data base request
    app.post('/agreement', verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        const data = req.body;

        // Find the user by email
        const user = await userCollection.findOne({ email: email });

        if (!user) {
          return res.status(403).send({ message: 'User not found' });
        }

        // Check if the user is an admin
        if (user.role === 'admin') {
          return res.send({
            message: 'Admin cannot make an agreement request',
            status: 'admin',
          });
        }

        // Check if the user is already a member
        if (user.role === 'member') {
          return res.send({
            message: 'Members cannot request a new agreement',
            status: 'alreadyMember',
          });
        }

        // Check if the user already has an agreement request
        const existingAgreement = await agreementCollection.findOne({
          email: email,
        });

        if (existingAgreement) {
          if (
            existingAgreement.status === 'pending' ||
            existingAgreement.status === 'booked' ||
            existingAgreement.status === 'checked'
          ) {
            return res.send({
              message: 'You already have an active agreement request',
              status: 'isExist',
            });
          } else if (existingAgreement.status === 'rejected') {
            // Allow new request if the previous one was rejected
            await agreementCollection.deleteOne({ email: email }); // Optional: Clear old rejected request
          } else {
            return res.send({
              message: 'You already have an agreement request',
              status: 'isExist',
            });
          }
        }

        // Insert new agreement request
        const newAgreement = {
          ...data,
          email,
          agreementDate: new Date(),
          status: 'pending', // Default status
        };

        const result = await agreementCollection.insertOne(newAgreement);

        if (result.insertedId) {
          return res.status(201).send({
            message: 'Agreement request submitted successfully',
          });
        } else {
          return res.status(500).send({
            message: 'Failed to submit agreement request',
          });
        }
      } catch (error) {
        console.error('Error handling agreement request:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    //get all agreement requests
    app.get(
      '/agreements/request',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await agreementCollection
          .find({ status: 'pending' })
          .toArray();
        res.send(result);
      }
    );

    //agrement status update and user to member
    app.patch(
      '/agreements/update/:id',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const {
            email,
            status,

            apartmentId,
          } = req.body;

          // console.log(email, status);

          if (!email) {
            return res.status(400).json({ message: 'Email is required' });
          }

          const existingUser = await userCollection.findOne({ email });
          if (existingUser?.role === 'member') {
            return res.status(400).json({
              message: 'This user is already a member and renting a room.',
            });
          }

          const updateApartmentStatus = await apartmentCollection.updateOne(
            { _id: new ObjectId(apartmentId) },
            {
              $set: { status: 'rented' },
            }
          );

          if (status === 'approved') {
            await userCollection.updateOne(
              { email },
              { $set: { role: 'member' } }
            );
          }

          const result = await agreementCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status, apartmentsId: id } }
          );

          if (result.modifiedCount > 0) {
            res.json({ message: 'Agreement updated successfully' });
          } else {
            res.status(400).json({ message: 'No changes were made' });
          }
        } catch (error) {
          console.error('Error updating agreement:', error);
          res.status(500).json({ message: 'Internal server error' });
        }
      }
    );

    //rejected id
    app.patch(
      '/agreements/reject/:id',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        try {
          const filter = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: { status: 'rejected' }, // Agreement status update to 'rejected'
          };

          const result = await agreementCollection.updateOne(filter, updateDoc);

          if (result.modifiedCount > 0) {
            return res.status(200).json({
              success: true,
              message: 'Agreement rejected successfully.',
            });
          } else {
            return res.status(400).json({
              success: false,
              message: 'Agreement not found or already rejected.',
            });
          }
        } catch (error) {
          console.error('Error rejecting agreement:', error);
          return res
            .status(500)
            .json({ success: false, message: 'Internal server error.' });
        }
      }
    );

    app.get('/users/profile', verifyToken, async (req, res) => {
      const email = req.query.email;

      const findApotment = {
        email: email,
        status: 'approved',
      };
      const agrementDetails = await agreementCollection.findOne(findApotment);

      res.send(agrementDetails);
    });

    //payment seystem
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: req.body.amount, // amount in cents
          currency: 'usd',
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
          paymentId: paymentIntent.id,
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    //get all coupons
    app.get('/coupons', async (req, res) => {
      const result = await couponCollection.find().toArray();
      res.send(result);
    });

    //couponn validation
    app.get('/coupons/:code', async (req, res) => {
      try {
        const { code } = req.params;
        const coupon = await couponCollection.findOne({ couponCode: code });

        if (!coupon) {
          return res.status(404).json({ message: 'Invalid coupon code' });
        }

        if (!coupon.isActive) {
          return res.status(400).json({ message: 'This coupon is not active' });
        }

        res.json({
          discountPercentage: coupon.discountPercentage,
          description: coupon.description,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    //payment deatails save database
    app.post('/payments/save', verifyToken, verifyMember, async (req, res) => {
      const data = req.body;
      const result = await paymentCollection.insertOne(data);
      res.send(result);
    });

    //payment history
    app.get('/payment-history', verifyToken, verifyMember, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      console.log('Requesting payment history for:', email);
      const result = await paymentCollection
        .find({ userEmail: email })
        .toArray();

      // console.log("Payment History Result:", result);
      res.send(result);
    });

    // get all /announcement
    app.get('/announcement/', async (req, res) => {
      const result = await announcementsCollection.find().toArray();
      res.send(result);
    });

    //post a new /announcement
    app.post('/announcement', verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const reasult = await announcementsCollection.insertOne(data);
      res.send(reasult);
    });

    // /announcement deaete a /announcement
    app.delete("/announcement/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        console.log("Deleting announcement with ID:", id);
    
        const result = await announcementsCollection.deleteOne({ _id: new ObjectId(id) });
    
        if (result.deletedCount === 1) {
          res.send({ success: true, message: "Announcement deleted successfully!" });
        } else {
          res.status(404).send({ success: false, message: "Announcement not found!" });
        }
      } catch (error) {
        console.error("Delete error:", error);
        res.status(500).send({ success: false, message: "Internal Server Error" });
      }
    });
    
    // single announcement data get 
    app.get("/announcement/:id", async (req,res) => {
      const id = req.params.id;
      const result = await announcementsCollection.findOne({_id : new ObjectId(id)})
      res.send(result)
    })

    // announcemetn edit 
    app.patch("/announcement/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const data = req.body;
        
        // Ensure ID is correctly formatted
        const objectId = new ObjectId(id);
    
        // Update announcement in the database
        const result = await announcementsCollection.updateOne(
          { _id: objectId },
          { $set: data } // Update only the fields sent in the request
        );
    
        if (result.modifiedCount > 0) {
          res.json({ success: true, message: "Announcement updated successfully!" });
        } else {
          res.status(404).json({ success: false, message: "No announcement found or no changes made." });
        }
      } catch (error) {
        console.error("Error updating announcement:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
      }
    });
    

    
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // // // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 });
    // console.log(
    //   'Pinged your deployment. You successfully connected to MongoDB!'
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.options('*', cors());

app.get('/', (req, res) => {
  res.send('Sky FLow Server is Running');
});

app.listen(port, () => {
  console.log('Sky FLow Server is Running at', port);
});
