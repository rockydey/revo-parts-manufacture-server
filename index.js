const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DE_PASSWORD}@revo.hg0p9.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();

        const partsCollection = client.db("revo_parts").collection("parts");
        const ordersCollection = client.db("revo_parts").collection("orders");
        const usersCollection = client.db("revo_parts").collection("users");
        const reviewsCollection = client.db("revo_parts").collection("reviews");
        const paymentsCollection = client.db("revo_parts").collection("payments");

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            } else {
                res.status(403).send({ message: 'forbidden access' });
            }
        };

        app.get('/part', async (req, res) => {
            const query = {};
            const cursor = partsCollection.find(query);
            const parts = await cursor.toArray();
            res.send(parts);
        });

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d'
            });
            res.send({ result, token });
        });

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        });

        app.get('/purchase/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await partsCollection.findOne(query);
            res.send(result);
        });

        app.put('/purchase/:id', verifyJWT, async (req, res) => {
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

        app.put('/update/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const update = req.body;
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    quantity: update.quantity
                }
            };
            const result = await partsCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        app.post('/purchase', verifyJWT, async (req, res) => {
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

        app.post('/users', verifyJWT, async (req, res) => {
            const user = req.body;
            const filter = {
                email: user.email
            };
            const newUser = {
                name: user.name,
                email: user.email,
                number: user.phone
            };
            const exits = await usersCollection.findOne(filter);
            if (exits) {
                return res.send({ success: false, booking: exits });
            }
            const result = await usersCollection.insertOne(newUser);
            return res.send({ success: true, result });
        });

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const cursor = usersCollection.find(query);
            const users = await cursor.toArray();
            res.send(users);
        });

        app.delete('/user/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });

        app.get('/purchase', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const purchase = await ordersCollection.find(query).toArray();
                res.send(purchase);
            } else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        });

        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await ordersCollection.findOne(query)
            res.send(order);
        });

        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const payment = req.body;
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            };
            const result = await paymentsCollection.insertOne(payment);
            const updatedOrder = await ordersCollection.updateOne(filter, updateDoc);
            res.send(updatedOrder);
        });

        app.put('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const approve = req.body;
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    approve: approve.approve
                }
            };
            const updatedOrder = await ordersCollection.updateOne(filter, updateDoc, options);
            res.send(updatedOrder);
        });

        app.delete("/purchase/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(filter);
            res.send(result);
        });

        app.post('/review', verifyJWT, async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.send(result);
        });

        app.put('/user', verifyJWT, async (req, res) => {
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

        app.get('/order', verifyJWT, async (req, res) => {
            const query = {};
            const cursor = ordersCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
        });

        app.get('/user', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const updatedUser = await usersCollection.find(query).toArray();
            res.send(updatedUser);
        });

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const order = req.body;
            const price = order.total;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.get('/review', async (req, res) => {
            const query = {};
            const cursor = reviewsCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        app.post("/part", verifyJWT, verifyAdmin, async (req, res) => {
            const part = req.body;
            const result = await partsCollection.insertOne(part);
            res.send(result);

        });

        app.get('/managePart', async (req, res) => {
            const query = {};
            const cursor = partsCollection.find(query);
            const manageParts = await cursor.toArray();
            res.send(manageParts);
        });
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