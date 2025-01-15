require('dotenv').config()
const express = require("express");
const cors = require("cors")
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const nodemailer = require('nodemailer')

const port = process.env.PORT || 9000
const app = express()

const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ikf6y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});




async function run() {
  try {

























    
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req,res) => {
  res.send("Sky FLow Server is Running")
})

app.listen(port , () => {
  console.log("Sky FLow Server is Running at", port)
})