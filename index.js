
import express from 'express';
import cors from 'cors'
import dotenv from 'dotenv'


dotenv.config();
const app = express();
const port = process.env.PORT || 3000

// middleware 
app.use(cors())
app.use(express.json())

// firebase admin sdk
import admin from "firebase-admin";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("./degital-life-lesson.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
;


import { MongoClient, ServerApiVersion } from 'mongodb'

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster01.g0bc8bl.mongodb.net/?appName=Cluster01`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// vefify Firebase Token
const verifyFirebaseToken = async (req, res, next) => {

    const authorization = req.headers.authorization
    if (!authorization) {
        return res.status(401).send('unauthorized access')
    }

    try {
        const Token = authorization.split(' ')[1]

        const decoded = await admin.auth().verifyIdToken(Token)
        req.decoded_email = decoded.email

        next()
    }
    catch (error) {
        // console.log(error);
        return res.status(401).send('unauthorized access')
    }
}

async function run() {

    try {
        await client.connect();

        const db = client.db('life-lessons')
        const userCollection = db.collection('users')
        const lessonCollection = db.collection('lessons')

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
                    role: 'user',
                    isPremium: false,
                    createAt: new Date()
                }

                const result = await userCollection.insertOne(newUser)
                res.send(result);

            } catch (error) {

                res.status(500).json({ message: "Internal server error" });
            }
        })

        app.get('/users/:email/user', verifyFirebaseToken, async (req, res) => {

            const email = req.params.email
            // console.log(email);

            const user = await userCollection.findOne({
                email: { $regex: new RegExp(`^${email}$`, 'i') }
            })
            console.log('user data', user);

            res.send(user);
        })

        // lesson related apis
        app.post('/lessons', verifyFirebaseToken, async (req, res) => {

            const lesson = req.body;

            const user = await userCollection.findOne({ email: lesson.authorEmail });

            if (!user.isPremium && lesson.accessLevel === "premium") {
                return res.status(403).send({ message: "Upgrade to premium to post premium lessons" });
            }

            lesson.createdAt = new Date();

            const result = await lessonCollection.insertOne(lesson);
            res.send({ success: true, message: "Lesson added successfully!", result });
        })
        app.get('/lessons/public', async (req, res) => {

            const result = await lessonCollection.find({ privacy:"public"}).toArray()
            res.send(result);
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
