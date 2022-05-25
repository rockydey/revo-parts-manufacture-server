const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DE_PASSWORD}@revo.hg0p9.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();

        const partsCollection = client.db("revo_parts").collection("parts");
        const ordersCollection = client.db("revo_parts").collection("orders");
        const usersCollection = client.db("revo_parts").collection("users");
        const reviewsCollection = client.db("revo_parts").collection("reviews");

        app.get('/part', async (req, res) => {
            const query = {};
            const cursor = partsCollection.find(query);
            const parts = await cursor.toArray();
            res.send(parts);
        });

        app.get('/purchase/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await partsCollection.findOne(query);
            res.send(result);
        });

        app.put('/purchase/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const newQuantity = req.body;
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    quantity: newQuantity.quantity
                }
            };
            const result = await partsCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        app.post('/purchase', async (req, res) => {
            const purchase = req.body;
            const filter = {
                email: purchase.email,
                productName: purchase.productName
            };
            const exits = await ordersCollection.findOne(filter);
            if (exits) {
                return res.send({ success: false, booking: exits });
            }
            const result = await ordersCollection.insertOne(purchase);
            return res.send({ success: true, result });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const filter = {
                email: user.email
            };
            const newUser = {
                name: user.name,
                email: user.email,
                phone: user.phone
            };
            const exits = await usersCollection.findOne(filter);
            if (exits) {
                return res.send({ success: false, booking: exits });
            }
            const result = await usersCollection.insertOne(newUser);
            return res.send({ success: true, result });
        });

        app.get('/user', async (req, res) => {
            const query = {};
            const cursor = usersCollection.find(query);
            const users = await cursor.toArray();
            res.send(users);
        });

        app.get('/purchase', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const purchase = await ordersCollection.find(query).toArray();
            res.send(purchase);
        });

        app.delete("/purchase/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(filter);
            res.send(result);
        });

        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.send(result);
        });

        app.put('/user', async (req, res) => {
            const user = req.body;
            const filter = {
                email: user.email
            };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        app.get('/order', async (req, res) => {
            const query = {};
            const cursor = ordersCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
        })
    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send("Hello From Revo Part's!");
});
app.listen(port, () => {
    console.log(`Revo Part's app listening on port ${port}`);
});