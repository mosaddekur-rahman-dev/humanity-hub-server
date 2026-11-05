import cors from "cors";
import "dotenv/config";
import express from "express";
import { MongoClient } from "mongodb";
import { ObjectId } from "mongodb";

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();

const db = mongoClient.db("humanity-hub");

const eventCollection = db.collection("event");
const joinedColletion = db.collection("joined");

app.post("/add-event", async (req, res) => {
  const data = req.body;
  const result = await eventCollection.insertOne(data);
  res.send(result);
});

app.get("/events", async (req, res) => {
  const result = await eventCollection.find().toArray();
  res.send(result);
});

app.get("/events/:id", async (req, res) => {
  const { id } = req.params;
  const result = await eventCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.post("/joined", async (req, res) => {
  const data = req.body;
  const result = await joinedColletion.insertOne(data);

  res.send(result);
});

//http:localhost:8000
app.get("/", (req, res) => {
  res.send({ message: "server is running fine" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
