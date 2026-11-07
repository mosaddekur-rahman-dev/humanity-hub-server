import cors from "cors";
import "dotenv/config";
import express from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { MongoClient, ObjectId } from "mongodb";

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
    throw err;
  }
}

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ msg: "unauthorized" });
  }
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ msg: "unauthorized" });
  }

  const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
  );

  try {
    const { payload } = await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    return res.status(500).send({ msg: "Internal server error" });
  }
};

const mongoClient = await connectToMongoDB();

const db = mongoClient.db("humanity-hub");

const eventCollection = db.collection("event");
const joinedCollection = db.collection("joined");

app.post("/add-event", async (req, res) => {
  try {
    const result = await eventCollection.insertOne(req.body);
    res.send(result);
  } catch (err) {
    res
      .status(500)
      .send({ message: "Failed to add event", error: err.message });
  }
});

app.get("/events", async (req, res) => {
  const result = await eventCollection.find().toArray();
  res.send(result);
});

app.get("/events/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid id" });
  }
  const result = await eventCollection.findOne({ _id: new ObjectId(id) });
  if (!result) return res.status(404).send({ message: "Event not found" });
  res.send(result);
});

app.put("/events/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid id" });
  }

  const { _id, email, username, ...updates } = req.body;

  const result = await eventCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updates },
  );
  res.send(result);
});

app.delete("/events/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid id" });
  }
  const result = await eventCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.get("/manage/:email", async (req, res) => {
  const { email } = req.params;
  const result = await eventCollection.find({ email }).toArray();
  res.send(result);
});

app.post("/joined", async (req, res) => {
  const result = await joinedCollection.insertOne(req.body);
  res.send(result);
});

app.get("/my-joined/:email", async (req, res) => {
  const { email } = req.params;
  const result = await joinedCollection.find({ email }).toArray();
  res.send(result);
});

app.get("/", (req, res) => {
  res.send({ message: "server is running fine" });
});

if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
