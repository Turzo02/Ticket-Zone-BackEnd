const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

const cors = require("cors");
require("dotenv").config();

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.TZ_USER}:${process.env.TZ_PASS}@smartproduct.gqn7fwo.mongodb.net/?appName=SmartProducT`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    //Creating Database
    const ticketZoneCollection = client.db("ticketZone").collection("ticket");
    const bookingsCollection = client.db("ticketZone").collection("bookings");

    //Tickets Api
    app.post("/ticket", async (req, res) => {
      const ticket = req.body;
      const result = await ticketZoneCollection.insertOne(ticket);
      res.send(result);
    });

    //  get api
    app.get("/ticket", async (req, res) => {
      const emailFromClient = req.query.vendorEmail
        //http://localhost:3000/ticket?vendorEmail=alex.morgan@example.com
       let query = {}
       if(emailFromClient){
        query = { vendorEmail : emailFromClient}
       }
      const result = await ticketZoneCollection.find(query).toArray();
      res.send(result);
    });

    

    // sample get by id
    app.get("/ticket/:id", async (req, res) => {
      const id = req.params.id;
      const ticket = await ticketZoneCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(ticket);
    });

    //sample update by id
    // app.patch("/ticket/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const data = { price: 60 };
    //   const ticket = await ticketZoneCollection.updateOne(
    //     { _id: new ObjectId(id) },
    //     { $set: data }
    //   );
    //   res.send(ticket);
    // });

    //sample delete by id
    app.delete("/ticket/:id", async (req, res) => {
      const id = req.params.id;
      const result = await ticketZoneCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    //Bookings API
    app.get("/bookings", async (req, res) => {
      const result = await bookingsCollection.find().toArray();
      res.send(result);
    })

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Ticket Zone Server is Running!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
