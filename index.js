const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

const cors = require("cors");
require("dotenv").config();

//middleware
app.use(cors());
app.use(express.json());

//firebase
const admin = require("firebase-admin");
const serviceAccount = require("./ticket-zone-firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// FirebaseToken middleware
const verifyFirebaseToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res
      .status(403)
      .send({ error: true, message: "unauthorized access" });
  }
  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ error: true, message: "forbidden access" });
  }
};

const uri = `mongodb+srv://${process.env.TZ_USER}:${process.env.TZ_PASS}@smartproduct.gqn7fwo.mongodb.net/?appName=SmartProducT`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//Stripe
const stripe = require("stripe")(process.env.STRIPE_KEY);

async function run() {
  try {
    await client.connect();
    //Creating Database
    const ticketZoneCollection = client.db("ticketZone").collection("ticket");
    const bookingsCollection = client.db("ticketZone").collection("bookings");
    const usersCollection = client.db("ticketZone").collection("users");

    // 🎫🎫🎫Tickets Api✅
    app.post("/ticket", verifyFirebaseToken, async (req, res) => {
      //only vendor can post/add ticket
      const emailFromClient = req.decoded_email;
      const user = await usersCollection.findOne({ email: emailFromClient });
      if (user.role !== "vendor") {
        return res
          .status(403)
          .send({ error: true, message: " Tor access Nai Vag" });
      }

      const ticket = req.body;
      const ticketWithTimestamp = { ...ticket, createdAt: new Date() };
      const result = await ticketZoneCollection.insertOne(ticketWithTimestamp);
      res.send(result);
    });

    // get api for✅
    app.get("/ticket", async (req, res) => {
      const emailFromClient = req.query.vendorEmail;
      const transportFilter = req.query.transport;
      const sortOrder = req.query.sort;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 7;
      const skip = (page - 1) * limit;
      const statusFilter = req.query.status;
      const fromLocation = req.query.from;
      const toLocation = req.query.to;
      let query = {};
      let sortOptions = {};
      sortOptions = { createdAt: -1 };

      if (emailFromClient) {
        query.vendorEmail = emailFromClient;
      }
      if (transportFilter) {
        query.transportType = transportFilter;
      }
      if (statusFilter) {
        query.status = statusFilter;
      }

      const isAdvertisedParam = req.query.isAdvertised;
      if (isAdvertisedParam === "true") {
        query.isAdvertised = true;
      } else if (isAdvertisedParam === "false") {
        query.isAdvertised = false;
      }
      if (fromLocation) {
        query.from = { $regex: fromLocation, $options: "i" };
      }
      if (toLocation) {
        query.to = { $regex: toLocation, $options: "i" };
      }
      if (sortOrder === "asc") {
        sortOptions = { price: 1 };
      } else if (sortOrder === "desc") {
        sortOptions = { price: -1 };
      }

      const total = await ticketZoneCollection.countDocuments(query);

      const tickets = await ticketZoneCollection
        .find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .toArray();

      res.send({
        total,
        page,
        limit,
        tickets,
      });
    });

    //get only accepted status ticket
    app.get("/ticket/status/:status", verifyFirebaseToken, async (req, res) => {
      //only vendor has access this
      const emailFromClient = req.decoded_email;
      const user = await usersCollection.findOne({ email: emailFromClient });
      if (user.role !== "vendor") {
        return res
          .status(403)
          .send({ error: true, message: "You have no access" });
      }
      const status = req.params.status;
      const tickets = await ticketZoneCollection
        .find({ status: status })
        .toArray();
      res.send(tickets);
    });

    //Any specific vendor tickets api
    app.get("/ticket/vendor/:vendorEmail", verifyFirebaseToken, async (req, res) => {
      //only vendor has access this
      const emailFromClient = req.decoded_email;
      const user = await usersCollection.findOne({ email: emailFromClient });
      if (user.role !== "vendor") {
        return res
          .status(403)
          .send({ error: true, message: "You have no access" });
      }
      const vendorEmail = req.params.vendorEmail;
      const tickets = await ticketZoneCollection
        .find({ vendorEmail: vendorEmail })
        .toArray();
      res.send(tickets);
    });

    // sample get by id✅
    app.get("/ticket/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const ticket = await ticketZoneCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(ticket);
    });

    // isAdvertised Count API✅
    app.get(
      "/ticket/dashboard/advertised-count",
      verifyFirebaseToken,
      async (req, res) => {
        //only admin can get
        const emailFromClient = req.decoded_email;
        const user = await usersCollection.findOne({ email: emailFromClient });
        if (user.role !== "admin") {
          return res
            .status(403)
            .send({ error: true, message: " Tor access Nai Vag" });
        }
        const count = await ticketZoneCollection.countDocuments({
          isAdvertised: true,
        });
        res.send({ count: count });
      }
    );

    // sample update by id✅
    app.patch("/ticket/:id", verifyFirebaseToken, async (req, res) => {
      //only admin can access this and can accept and reject ticket reques from vendor
      const emailFromClient = req.decoded_email;
      const user = await usersCollection.findOne({ email: emailFromClient });
      if (user.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "you are not admin" });
      }
      const id = req.params.id;
      const updateDoc = req.body;
      const result = await ticketZoneCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateDoc }
      );
      res.send(result);
    });

    //for vendor to update ticket
    app.patch(
      "/ticket/vendor/:vendorEmail",
      verifyFirebaseToken,
      async (req, res) => {
        //only for vendor to update ticket
        const emailFromClient = req.decoded_email;
        const user = await usersCollection.findOne({ email: emailFromClient });
        if (user.role !== "vendor") {
          return res
            .status(403)
            .send({ error: true, message: "you are not vendor" });
        }
        const vendorEmail = req.params.vendorEmail;
        const updateDoc = req.body;
        const result = await ticketZoneCollection.updateOne(
          { vendorEmail: vendorEmail },
          { $set: updateDoc }
        );
        res.send(result);
      }
    );

    //sample delete by id✅
    app.delete("/ticket/:id", verifyFirebaseToken, async (req, res) => {
      //only vendor can delete ticket
      const emailFromClient = req.decoded_email;
      const user = await usersCollection.findOne({ email: emailFromClient });
      if (user.role !== "vendor") {
        return res
          .status(403)
          .send({ error: true, message: " Tor access Nai Vag" });
      }
      const id = req.params.id;
      const result = await ticketZoneCollection.deleteOne({
        _id: new ObjectId(id),
      });
      //then delete all the bookings for this ticket
      await bookingsCollection.deleteMany({ ticketId: id });
      res.send(result);
    });

    //delete all tickets of A vendor with vendorEmail ✅
    app.delete("/ticket/vendor/:vendorEmail", verifyFirebaseToken, async (req, res) => {
      //only admin has access this api
      const emailFromClient = req.decoded_email;
      const user = await usersCollection.findOne({ email: emailFromClient });
      if (user.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "You have no access" });
      }
      const vendorEmail = req.params.vendorEmail;
      const result = await ticketZoneCollection.deleteMany({ vendorEmail: vendorEmail });
      res.send(result);
    });

    // 🪪🪪🪪🪪Bookings API✅
    app.get("/bookings", verifyFirebaseToken, async (req, res) => {
      //only vendor can see all the requested ticket
      const emailFromClient = req.decoded_email;
      const user = await usersCollection.findOne({ email: emailFromClient });
      if (user.role !== "vendor") {
        return res
          .status(403)
          .send({ error: true, message: "ja vai Tor access Nai Vag" });
      }
      const result = await bookingsCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    //✅
    app.get("/bookings/unique/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const result = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    //✅
    app.get(
      "/bookings/revenue/:paymentStatus",
      verifyFirebaseToken,
      async (req, res) => {
        //only vendor can access this paid or unpaid booking revenue
        const emailFromClient = req.decoded_email;
        const user = await usersCollection.findOne({ email: emailFromClient });
        if (user.role !== "vendor") {
          return res.status(403).send({
            error: true,
            message: "You must be a vendor to get access",
          });
        }
        const paymentStatus = req.params.paymentStatus;
        const result = await bookingsCollection
          .find({ paymentStatus: paymentStatus })
          .toArray();
        res.send(result);
      }
    );

    //✅
    app.get("/bookings/:email",  async (req, res) => {
      const email = req.params.email;
      const result = await bookingsCollection
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    //✅
    app.post("/bookings", verifyFirebaseToken, async (req, res) => {
      //everyone can access this
      const booking = req.body;
      const bookingWithTimestamp = { ...booking, createdAt: new Date() };
      const result = await bookingsCollection.insertOne(bookingWithTimestamp);
      res.send(result);
    });

    //✅
    app.patch("/bookings/:id", verifyFirebaseToken, async (req, res) => {
      //only vendor can accept/reject ticket request
      const emailFromClient = req.decoded_email;
      const user = await usersCollection.findOne({ email: emailFromClient });
      if (user.role !== "vendor") {
        return res
          .status(403)
          .send({ error: true, message: "you must be a vendor" });
      }
      const id = req.params.id;
      const status = req.body.status;
      const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: status } }
      );
      res.send(result);
    });

    // 🙋🙋🙋🙋🙋Users api
    //only Admin can access this UserManagement Panel
    app.get("/users", verifyFirebaseToken, async (req, res) => {
      const emailFromClient = req.decoded_email;
      const user = await usersCollection.findOne({ email: emailFromClient });
      if (user.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "You are not admin" });
      }
      const result = await usersCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    //Free for all users if logged in
    app.get("/users/:email", verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      res.send(user);
    });

    //only admin can make a user admin or vendor
    app.patch("/users/:id", verifyFirebaseToken, async (req, res) => {
      const emailFromClient = req.decoded_email;
      const user = await usersCollection.findOne({ email: emailFromClient });
      if (user.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "You are not admin" });
      }
      const id = req.params.id;
      const updateDoc = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateDoc }
      );
      res.send(result);
    });

    //Anyone can create a user by login or sign up
    app.post("/users", async (req, res) => {
      const user = req.body;
      const email = user.email;
      const userExist = await usersCollection.findOne({ email: email });
      if (userExist) {
        return res.send({ message: "user already exist" });
      }
      const userWithTimestamp = { ...user, createdAt: new Date() };
      const result = await usersCollection.insertOne(userWithTimestamp);
      res.send(result);
    });

    // 🌟🌟🌟Payment Related Api

    app.post("/payment-checkout-session", async (req, res) => {
      const ticketInfo = req.body;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: ticketInfo.totalPrice * 100,
              product_data: {
                name: `Please pay for: ${ticketInfo.title}`,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          id: ticketInfo.id,
          ticketId: ticketInfo.ticketId,
          transactionId: ticketInfo.transactionId,
          bookingQuantity: ticketInfo.bookingQuantity,
          quantity: ticketInfo.quantity,
        },
        customer_email: ticketInfo.userEmail,
        success_url: `${process.env.DOMAIN_SITE}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.DOMAIN_SITE}/payment-failed?session_id={CHECKOUT_SESSION_ID}`,
      });

      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const id = session.metadata?.id;
      const ticketId = session.metadata?.ticketId;
      const bookingQuantity = session.metadata?.bookingQuantity;
      const quantity = session.metadata?.quantity;
      const transactionId = session.payment_intent;
      if (!id) {
        return res
          .status(404)
          .send({ message: "Ticket ID not found in session metadata." });
      }
      const updateDoc = {
        paymentStatus: "paid",
        transactionId: transactionId,
        paidAt: new Date(),
      };
      const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateDoc }
      );

      const finalquantity = quantity - bookingQuantity;
      const testpatch = await ticketZoneCollection.updateOne(
        { _id: new ObjectId(ticketId) },
        { $set: { quantity: finalquantity } }
      );
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
