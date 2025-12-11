
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
import Stripe from 'stripe';
const strip = new Stripe(process.env.STRIPE_SECRET_KEY)


import { MongoClient, ServerApiVersion } from 'mongodb'
import { log } from 'console';

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
        // console.log('access token',Token);

        const decoded = await admin.auth().verifyIdToken(Token)
        // console.log('after decoded',decoded);

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
            // console.log('user data', user);
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

            try {
                const { limit = 0, skip = 0, sort, tone, category, search } = req.query

                let query = { privacy: "public" }

                if (search) {
                    query.title = { $regex: search, $options: 'i' }
                }
                if (category) {
                    query.category = category
                }
                if (tone) {
                    query.tone = tone
                }

                let sortOptions = {}
                if (sort === 'newest') sortOptions.createdAt = -1;
                if (sort === 'oldest') sortOptions.createdAt = 1;
                // if(sort === 'mostSaved') sortOptions.savedCount  = -1;

                const result = await lessonCollection.find(query)
                    .limit(Number(limit))
                    .skip(Number(skip))
                    .sort(sortOptions)
                    .toArray()

                const count = await lessonCollection.countDocuments();
                res.send({
                    result, total: count
                });
            } catch (error) {
                console.log(error);

            }
        })

        app.post('/create-checkout-session', async (req, res) => {

          try{
              const { price, currency, email } = req.body

            const session = await strip.checkout.sessions.create({

                line_items: [

                    {
                        price_data: {
                            currency,
                            unit_amount: price * 100,
                            product_data: {
                                name: "Premium Lifetime Access",
                            },                    
                        },
                        quantity: 1
                    }
                ],
                mode: 'payment',
                customer_email: email,
                success_url: `${process.env.SITE_DOMAIN}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/payment/cancel`,
            })
            
            res.send({url:session.url})

          }catch(error){
            console.log(error);       
          res.status(500).json({ error: err.message });
          }
        })

        app.patch('/payment-success', async (req, res) => {

            const session_id =req.query.session_id

            const session = await strip.checkout.sessions.retrieve(session_id)
            
           if(session.payment_status === 'paid'){
             const email = session.customer_email
            const query = {}
            if(email){
                query.email = email
            }
            const update = {
                $set: {
                    isPremium : true
                }
            }
            const result = await userCollection.updateOne(query,update)
            res.send(result);
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
