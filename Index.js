require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const nodemailer = require('nodemailer');

const port = process.env.PORT || 9000;
const app = express();

const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
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

async function run() {
  try {
    await client.connect();
    const db = client.db('SkyFlow');
    const userCollection = db.collection('users');
    const apartmentCollection = db.collection('apartments');

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
      console.log(email, query, user);
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

    // apartments collection to home page data get
    app.get('/apartments', async (req, res) => {
      const result = await apartmentCollection
        .find({})
        .sort({ createdAt: -1 })
        .project({
          images: { $arrayElemAt: ['$images', 0] },
          floorNo: 1,
          blockNo: 1,
          price: 1,
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
        console.log("Received Query Params:", req.query);
    
        const query = {};
    
        // Check and apply rent filters
        if (req.query.minRent) {
          query.price = { $gte: parseInt(req.query.minRent) };
        }
        if (req.query.maxRent) {
          query.price = { ...query.price, $lte: parseInt(req.query.maxRent) };
        }
    
        console.log("Applied Query Filter:", query);
    
        const total = await apartmentCollection.countDocuments(query);
        const apartments = await apartmentCollection
          .find(query)
          .skip(skip)
          .limit(limit)
          .project({
            images: { $arrayElemAt: ['$images', 0] },
            floorNo: 1,
            blockNo: 1,
            price: 1,
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
    

    app.get('/apartments/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await apartmentCollection.findOne(query);
      res.send(result);
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
