
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


import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'

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
        // console.log('access token', Token);

        const decoded = await admin.auth().verifyIdToken(Token)
        // console.log('after decoded', decoded);

        req.decoded_email = decoded.email
        req.photo = decoded.picture
        req.name = decoded.name
        next()
    }
    catch (error) {
        console.log(error);
        return res.status(401).send('unauthorized access')
    }
}

async function run() {

    try {
        await client.connect();

        const db = client.db('life-lessons')
        const userCollection = db.collection('users')
        const lessonCollection = db.collection('lessons')
        const favoriteCollection = db.collection('favorite')
        const reportCollection = db.collection('report')
        const commentCollection = db.collection('comment');

        // user releted APIS

        app.post('/users', async (req, res) => {

            try {

                const user = req.body;
                user.email = user.email.toLowerCase()

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

        app.get('/lessons/:id', verifyFirebaseToken, async (req, res) => {

            try {
                const id = req.params.id
                const lessonId = { _id: new ObjectId(id) }

                const lesson = await lessonCollection.findOne(lessonId);
                if (!lesson) {
                    return res.status(404).json({ message: 'Lesson not found' });
                }

                const user = await userCollection.findOne({ email: req.decoded_email.toLowerCase() })
                if (!user) {
                    return res.status(401).json({ message: 'User not found' });
                }

                if (lesson.accessLevel === 'premium' && !user.isPremium) {

                    return res.status(403).json({ error: 'premium_locked', message: 'Upgrade to view this lesson.' });

                }

                const email = lesson.authorEmail
                let author = null
                let totalLesson = 0

                if (email) {

                    author = await userCollection.findOne({ email: email })
                    totalLesson = await lessonCollection.countDocuments({ authorEmail: email })
                }
                res.send({ lesson, author, totalLesson })

            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Server error' });
            }

        })

        app.patch('/lessons/:id/like', verifyFirebaseToken, async (req, res) => {

            try {
                const lessonId = req.params.id
                const email = req.decoded_email

                const lesson = await lessonCollection.findOne({
                    _id: new ObjectId(lessonId)
                })

                if (!lesson) {
                    return res.status(404).send({ message: 'Lesson not found' })
                }

                const alreadyLiked = lesson.likedBy?.includes(email)

                //  UNLIKE
                if (alreadyLiked) {
                    await lessonCollection.updateOne(
                        { _id: lesson._id },
                        {
                            $pull: { likedBy: email },
                            $inc: { likes: -1 }
                        }
                    )

                    return res.send({
                        liked: false,
                        likesChange: -1
                    })
                }

                //  LIKE
                await lessonCollection.updateOne(
                    { _id: lesson._id },
                    {
                        $addToSet: { likedBy: email },
                        $inc: { likes: 1 }
                    }
                )

                res.send({
                    liked: true,
                    likesChange: 1
                })

            } catch (err) {
                res.status(500).send({ error: err.message })
            }
        })
        app.patch('/lessons/:id/favorite', verifyFirebaseToken, async (req, res) => {
            try {
                const lessonId = req.params.id
                const email = req.decoded_email

                const query = {
                    lessonId,
                    userEmail: email
                }

                const alreadyFavorited = await favoriteCollection.findOne(query)

                //  UNSAVE
                if (alreadyFavorited) {
                    await favoriteCollection.deleteOne(query)

                    await lessonCollection.updateOne(
                        { _id: new ObjectId(lessonId) },
                        { $inc: { favoritesCount: -1 } }
                    )

                    return res.send({
                        favorited: false,
                        countChange: -1
                    })
                }

                // SAVE
                await favoriteCollection.insertOne({
                    lessonId,
                    userEmail: email,
                    createdAt: new Date()
                })

                await lessonCollection.updateOne(
                    { _id: new ObjectId(lessonId) },
                    { $inc: { favoritesCount: 1 } }
                )

                res.send({
                    favorited: true,
                    countChange: 1
                })

            } catch (error) {
                res.status(500).send({ error: error.message })
            }
        })
        app.post('/reports', verifyFirebaseToken, async (req, res) => {
            try {
                const { lesson, reason } = req.body
                const lessonId = lesson._id
                const userEmail = req.decoded_email

                // Prevent duplicate report by same user
                const exists = await reportCollection.findOne({ lessonId, userEmail })
                if (exists) {
                    return res.status(400).send({ message: 'You have already reported this lesson.' })
                }

                await reportCollection.insertOne({
                    lessonId,
                    userEmail,
                    reason,
                    createdAt: new Date()
                })

                await lessonCollection.updateOne(
                    { _id: new ObjectId(lessonId) },
                    { $inc: { reportsCount: 1 } }
                )

                res.send({ success: true })

            } catch (err) {
                console.error('REPORT ERROR:', err)
                res.status(500).send({ error: err.message })
            }
        })

        app.post('/comments', verifyFirebaseToken, async (req, res) => {
            try {
                const { lessonId, text } = req.body

                const comment = {
                    lessonId,
                    text,
                    userPhoto: req.photo,
                    userName: req.name,
                    userEmail: req.decoded_email,
                    createdAt: new Date()
                }

                await commentCollection.insertOne(comment)

                await lessonCollection.updateOne(
                    { _id: new ObjectId(lessonId) },
                    { $inc: { commentsCount: 1 } }
                )

                res.send({ success: true })

            } catch (err) {
                console.error('COMMENT ERROR:', err)
                res.status(500).send({ error: err.message })
            }
        })

        app.get('/comments/:lessonId', async (req, res) => {
            const lessonId = req.params.lessonId

            const comments = await commentCollection
                .find({ lessonId })
                .sort({ createdAt: -1 })
                .toArray()

            res.send(comments)
        })
        app.get('/lessons/:id/related', async (req, res) => {
            try {
                const lessonId = req.params.id

                const lesson = await lessonCollection.findOne({ _id: new ObjectId(lessonId) })

                const related = await lessonCollection
                    .find({ category: lesson.category, _id: { $ne: lesson._id } })
                    .limit(6)
                    .toArray()

                res.send(related)

            } catch (err) {
                console.error(err)
                res.status(500).send({ error: err.message })
            }
        })

        app.get('/lessons/author/:email', async (req, res) => {
            try {
                const email = req.params.email

                const lessons = await lessonCollection
                    .find({
                        authorEmail: email,
                        privacy: 'public'
                    })
                    .sort({ createdAt: -1 })
                    .toArray()

                res.send(lessons)

            } catch (err) {
                res.status(500).send({ error: err.message })
            }
        })

        app.get('/my-lessons', verifyFirebaseToken, async (req,res) => {

            const email= req.query.email
            if(email !== req.decoded_email){
                return res.status(403).send({message: 'forbidden access'});
            }

            const result = await lessonCollection.find({authorEmail: email}).toArray()
            res.send(result)
        })

        app.patch('/lessons/visibility/:id', verifyFirebaseToken, async (req,res) => {

            const id = req.params.id
            const {visibility} = req.body

            const query = {_id: new ObjectId(id)}

            const update = {
                $set: {
                    privacy : visibility
                }
            }
            const result = await lessonCollection.updateOne(query,update)
            console.log(result);
            
            res.send(result);
        })

        app.delete('/lessons/delete/:id',verifyFirebaseToken,async (req,res) => {

            const query = {_id: new ObjectId(req.params.id)}
            const result = await lessonCollection.deleteOne(query)
            console.log(result);
            
            res.send(result);
        })





        app.post('/create-checkout-session', async (req, res) => {

            try {
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

                res.send({ url: session.url })

            } catch (error) {
                console.log(error);
                res.status(500).json({ error: err.message });
            }
        })

        app.patch('/payment-success', async (req, res) => {

            const session_id = req.query.session_id

            const session = await strip.checkout.sessions.retrieve(session_id)

            if (session.payment_status === 'paid') {
                const email = session.customer_email
                const query = {}
                if (email) {
                    query.email = email
                }
                const update = {
                    $set: {
                        isPremium: true
                    }
                }
                const result = await userCollection.updateOne(query, update)
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
