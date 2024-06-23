
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const Joi = require("joi");
const { ValidationError } = require("joi");

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,25}$/;
const mongodbIdPattern = /^[0-9a-fA-F]{24}$/;


const app = express();
const PORT = process.env.PORT || 5000;

dotenv.config();

mongoose.connect(process.env.MONGODB_CONNECTION_STRING, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

const db = mongoose.connection;

// Access token generation function
function generateAccessToken(user) {
    return jwt.sign({ userId: user.userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30m' });
}

// Refresh token generation function
function generateRefreshToken(user) {
    return jwt.sign({ userId: user.userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '60m' });
}


// Define User schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    refreshToken: { type: String, required: true }
},
    { timestamps: true }
);
const User = mongoose.model('User', userSchema);

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(cors({
    origin: 'http://127.0.0.1:5500',
    optionsSuccessStatus: 200,
    credentials: true
}));

// Error Handler
const errorHandler = (error, req, res, next) => {
    // default error
    let status = 500;
    let data = { message: 'Internal Server Error' }

    if (error instanceof ValidationError) {
        status = 422;
        data.message = error.message;
        res.status(status).json(data)

        if (error.status) {
            status = error.status;
        }
        if (error.message) {
            data.message = error.message;
        }
        res.status(status).json(data);
    }
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.cookies.accessToken;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid access token' });
        }
        req.user = user;
        next();
    });
}

// Register user endpoint
app.post('/register', async (req, res, next) => {
    const userRegisterSchema = Joi.object({
        username: Joi.string().min(5).max(30).required(),
        name: Joi.string().max(30).required(),
        email: Joi.string().email().required(),
        password: Joi.string().pattern(passwordPattern).required(),
        confirmPassword: Joi.ref("password"),
    });
    const { error } = userRegisterSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
        return next(error);
    }

    try {
        const { name, email, username, password } = req.body;
        try {
            const emailInUse = await User.exists({ email });

            const usernameInUse = await User.exists({ username });

            if (emailInUse) {
                res.status(409).json({ message: "Email already registered, use another email!" });

                return next(error);
            }

            if (usernameInUse) {
                res.status(409).json({ message: "username already registered, use another username!" });


                return next(error);
            }
        } catch (error) {
            return next(error);
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, username, password: hashedPassword });
        const accessToken = generateAccessToken({ userId: user._id });
        const refreshToken = generateRefreshToken({ userId: user._id });
        user.refreshToken = refreshToken;

        await user.save();
        res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(201).json({ success: true, message: 'User registered successfully', user });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ success: false, message: 'Failed to register user' });
    }
});

// Login endpoint
app.post('/login', async (req, res, next) => {
    // we expect input data to be in such shape
    const userLoginSchema = Joi.object({
        username: Joi.string().min(5).max(30).required(),
        password: Joi.string().pattern(passwordPattern),
      });
  
      const { error } = userLoginSchema.validate(req.body);
  
      if (error) {
        return next(error);
      }
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Invalid credentials' });
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const accessToken = generateAccessToken({ userId: user._id });
        const refreshToken = generateRefreshToken({ userId: user._id });
        user.refreshToken = refreshToken;
        await user.save();
        res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(200).json({ success: true, message: 'Login Successful', accessToken, refreshToken });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ error: 'Failed to login user' });
    }
});

// Token refresh endpoint
app.post('/refreshtoken', async (req, res, next) => {
    const originalRefreshToken = req.cookies.refreshToken;

    if (!originalRefreshToken) {
        return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    try {
        const decodedToken = jwt.verify(originalRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const userId = decodedToken.userId; // Extract userId from the payload
        const user = await User.findById(userId);

        if (!user || originalRefreshToken !== user.refreshToken) {
            return res.status(403).json({ success: false, message: 'Invalid refresh token' });
        }

        const accessToken = generateAccessToken({ userId: user._id });
        const newRefreshToken = generateRefreshToken({ userId: user._id });
        user.refreshToken = newRefreshToken;
        await user.save();
        res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
        res.cookie('refreshToken', newRefreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(200).json({ success: true, user, accessToken, refreshToken: newRefreshToken, message: 'Access token refreshed' });
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(403).json({ success: false, message: 'Invalid refresh token' });
    }
});

// Logout endpoint
app.post('/signout', authenticateToken, async (req, res, next) => {
    try {
        const { refreshToken } = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(200).json({ success: true, message: 'Logout successful' });
        }

        const user = await User.findOne({ refreshToken });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        user.refreshToken = undefined;
        await user.save();

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.status(200).json({ success: true, message: 'Logout successful' });
    } catch (error) {
        console.error('Error logging out user:', error);
        res.status(500).json({ error: 'Failed to logout user' });
    }
});

// Protected route example
app.get('/protected', authenticateToken, (req, res, next) => {
    res.status(200).json({ success: true, message: 'This is a protected route', user: req.user });
});

// Get all users endpoint
app.get('/users/all', authenticateToken, async (req, res, next) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Define a new route to get user data by ID
app.get('/user/:id', authenticateToken, async (req, res, next) => {
    const getUserByIdSchema = Joi.object({
        id: Joi.string().regex(mongodbIdPattern).required(),
      });
  
      const { error } = getUserByIdSchema.validate(req.params);
  
      if (error) {
        return next(error);
      }
    try {
        const userId = req.params.id; // Get the user ID from the route parameter
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user data' });
    }
});


// Define Blog schema
const blogSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    photoPath: { type: String, required: true },
    author: { type: mongoose.SchemaTypes.ObjectId, ref: 'User' }
},
{timestamps: true}
);
const Blog = mongoose.model('Blog', blogSchema);

// route to create a blog
app.post('/create-blog', authenticateToken, async (req, res, next) => {
    const createBlogSchema = Joi.object({
        title: Joi.string().required(),
        author: Joi.string().regex(mongodbIdPattern).required(),
        content: Joi.string().required(),
        photo: Joi.string().required(),
      });
  
      const { error } = createBlogSchema.validate(req.body);
  
      if (error) {
        return next(error);
      }
    try {
        const { title, content, photo, author } = req.body;
        // read as buffer
        const buffer = Buffer.from(
            photo.replace(/^data:image\/(png|jpg|jpeg);base64,/, ""),
            "base64"
        );

        // allot a random name
        const imagePath = `${Date.now()}-${author}.png`;
        // save to cloudinary
        try {
            // response = await cloudinary.uploader.upload(photo);
            fs.writeFileSync(`storage/${imagePath}`, buffer);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to save photo' });
        }

        const newBlog = new Blog({ title, author, content, photoPath: `${process.env.BACKEND_SERVER_PATH}/storage/${imagePath}` });
        await newBlog.save();
        res.status(201).json({ success: true, message: 'Blog successfully created', newBlog })
    }
    catch (error) {
        console.error("Error creating Blog: ", error);
        res.status(500).json({ success: false, message: 'Failed to create Blog' });
    }
});

app.get('/getblogs', async (req, res, next) => {
    try {
        const blogs = await Blog.find({});
        res.json(blogs)
    }
    catch (error) {
        console.error('Error fetching all blogs:', error);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
})

app.get('/getblogbyid/:id', async (req, res, next) => {
    const getBlogByIdSchema = Joi.object({
        id: Joi.string().regex(mongodbIdPattern).required(),
      });
  
      const { error } = getBlogByIdSchema.validate(req.params);
  
      if (error) {
        return next(error);
      }
    try {
        const { id } = req.params;
        const blog = await Blog.findOne({ _id: id }).populate("author");
        res.status(200).json({ success: true, message: 'Blog Fetched Successfully', blog });
    }
    catch (error) {
        console.error('Error Fetching Blog: ', error);
        res.status(500).json({ success: false, message: 'Failed to fetch blog' })
    }
})

app.put('/updateblog', authenticateToken, async (req, res, next) => {
    const updateBlogSchema = Joi.object({
        title: Joi.string().required(),
        content: Joi.string().required(),
        author: Joi.string().regex(mongodbIdPattern).required(),
        blogId: Joi.string().regex(mongodbIdPattern).required(),
        photo: Joi.string(),
      });
  
      const { error } = updateBlogSchema.validate(req.body);
    try {
        const { title, content, photo, author, blogId } = req.body;

        // delete previous photo
        const blog = await Blog.findOne({ _id: blogId })

        if (photo) {
            const previousPhoto = blog.photoPath;
            previousPhoto = previousPhoto.split('/').at(-1);
            // delete phot
            fs.unlinkSync(`storage/${previousPhoto}`);
            // read as buffer
            const buffer = Buffer.from(photo.replace(/^data:image\/(png|jpg|jpeg);decodeBase64,/, ""), "base64");
            // allot a random name
            const imagePath = `${Date.now()}-${author}.png`;

            // save new photo locally
            fs.writeFileSync(`storage/${imagePath}`, buffer);

            await Blog.updateOne(
                { _id: blogId },
                {
                    title,
                    content,
                    photoPath: `${process.env.BACKEND_SERVER_PATH}/storage/${imagePath}`
                }
            );
        }
        else {
            await Blog.updateOne({ _id: blogId }, { title, content });
        }

        res.status(201).json({ success: true, message: 'Blog updated Successfully', blog })



    }
    catch (error) {
        console.error("Error Updating blog: ", error);
        res.status(500).json({ success: false, message: 'Updating Blog Failed' })
    }

});

app.delete('/deleteBlog/:id', authenticateToken, async (req, res, next) => {
    const deleteBlogByIdSchema = Joi.object({
        id: Joi.string().regex(mongodbIdPattern).required(),
      });
  
      const { error } = deleteBlogByIdSchema.validate(req.params);
  
      if (error) {
        return next(error);
      }
    try {
        const { id } = req.params;
        await Blog.deleteOne({ _id: id });
        await Comment.deleteMany({blog: id})
        res.status(201).json({ success: true, message: 'Blog Deleted Successfully' })
    }
    catch (error) {
        console.error('Error Deleting Blog', error)
        res.status(500).json({ success: false, message: 'Failed to delete Blog' })
    }

})

const commentSchema = new mongoose.Schema({
    content: { type: String, required: true },
    blog: { type: mongoose.SchemaTypes.ObjectId, ref: 'Blog' },
    author: { type: mongoose.SchemaTypes.ObjectId, ref: 'User' }
},
{timestamps: true}
);
const Comment = mongoose.model('Comment', commentSchema);

app.post('/createComment', authenticateToken, async (req, res, next) => {
    const createCommentSchema = Joi.object({
        content: Joi.string().required(),
        author: Joi.string().regex(mongodbIdPattern).required(),
        blog: Joi.string().regex(mongodbIdPattern).required()
    });

    const {error} = createCommentSchema.validate(req.body);

    if (error){
        return next(error);
    }
    try {
        const { content, blog, author } = req.body;

        const newComment = new Comment({
            content, blog, author
        });
        await newComment.save();
        res.status(201).json({ success: true, message: 'Comment Created Successfully', newComment })
    }
    catch (error) {
        console.error('Error creating Comment: ', error);
        res.status(500).json({ success: false, message: 'Failed to create Comment' })
    }
})

app.get('/getcommentsbyId/:id', authenticateToken, async (req, res, next) => {
    const getCommentByIdSchema = Joi.object({
        id: Joi.string().regex(mongodbIdPattern).required()
    });

    const {error} = getCommentByIdSchema.validate(req.params);

    if (error){
        return next(error);
    }
    try {
        const { id } = req.params;
        const comments = await Comment.find({ blog: id }).populate("author");
        res.status(201).json({ success: true, message: "Comments fetched successfully", comments });
    }
    catch (error) {
        console.error('Error fetching comments: ', error);
        res.status(500).json({ success: false, message: 'Failed to fetch comments' })
    }
})

app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
