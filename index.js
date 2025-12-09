
import express from 'express';
import cors from 'cors'
import dotenv from 'dotenv'


dotenv.config();
const app = express();
const port = process.env.PORT || 3000

// middleware 
app.use(cors())
app.use(express.json())

import { MongoClient, ServerApiVersion } from 'mongodb'

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster01.g0bc8bl.mongodb.net/?appName=Cluster01`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {

    try {
        await client.connect();

        const db = client.db('life-lessons')
        const userCollection = db.collection('users')

        // user releted APIS

        app.post('/users', async (req, res) => {

            try {

                const user = req.body;

                const isExist = await userCollection.findOne({ email: user?.email });
                if (isExist) {
                    return res.status(409).json({ message: "User already exists" });
                }

               const newUser = {
                ...user,
                 role:'user',
                isPremium : false,
                createAt : new Date()
               }

                const result = await userCollection.insertOne(newUser)
                res.send(result);

            } catch (error) {

                res.status(500).json({ message: "Internal server error" });
            }
        })





        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

        // await client.close();
    }
}
run().catch(console.dir);






// default route
app.get('/', (req, res) => {
    res.send('Hello World!')
})

// start server
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
