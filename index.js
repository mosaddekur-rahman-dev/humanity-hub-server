import cors from "cors";
import "dotenv/config";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = client
      .connect()
      .then(() => {
        console.log("You successfully connected to MongoDB!");
        return client.db("humanity-hub");
      })
      .catch((err) => {
        dbPromise = null; // retry on next request
        throw err;
      });
  }
  return dbPromise;
}

// attach collections to each request
app.use(async (req, res, next) => {
  try {
    const db = await getDb();
    req.events = db.collection("event");
    req.joined = db.collection("joined");
    next();
  } catch (err) {
    console.error("DB connection failed:", err);
    res.status(500).send({ message: "Database unavailable" });
  }
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).send({ msg: "unauthorized" });

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).send({ msg: "unauthorized" });
  }
};

app.post("/add-event", verifyToken, async (req, res) => {
  try {
    const result = await req.events.insertOne(req.body);
    res.send(result);
  } catch (err) {
    res
      .status(500)
      .send({ message: "Failed to add event", error: err.message });
  }
});

app.get("/events", async (req, res) => {
  res.send(await req.events.find().toArray());
});

app.get("/events/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id))
    return res.status(400).send({ message: "Invalid id" });
  const result = await req.events.findOne({ _id: new ObjectId(id) });
  if (!result) return res.status(404).send({ message: "Event not found" });
  res.send(result);
});

app.put("/events/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id))
    return res.status(400).send({ message: "Invalid id" });
  const { _id, email, username, ...updates } = req.body;
  const result = await req.events.updateOne(
    { _id: new ObjectId(id) },
    { $set: updates },
  );
  res.send(result);
});

app.delete("/events/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id))
    return res.status(400).send({ message: "Invalid id" });
  res.send(await req.events.deleteOne({ _id: new ObjectId(id) }));
});

app.get("/manage/:email", async (req, res) => {
  res.send(await req.events.find({ email: req.params.email }).toArray());
});

app.post("/joined", async (req, res) => {
  res.send(await req.joined.insertOne(req.body));
});

app.get("/my-joined/:email", async (req, res) => {
  res.send(await req.joined.find({ email: req.params.email }).toArray());
});

app.get("/", (req, res) => {
  res.send({ message: "server is running fine" });
});

if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}

export default app;
