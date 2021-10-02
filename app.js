require('dotenv').config()
const express = require('express')
const ejs = require('ejs')
const mongoose  = require('mongoose')
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')

const app = express()

app.use(express.static('public'))
app.set('view engine', 'ejs')
app.use(express.urlencoded({extended: true}))

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())

mongoose.connect('mongodb://localhost:27017/userDB', {useNewUrlParser: true})
// mongoose.set('useCreateIndex', true)

const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String,
    secret: String
})

// userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ['password']})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const User = new mongoose.model('User', userSchema)

passport.use(User.createStrategy())
// passport.serializeUser(User.serializeUser()) // just for local authentication
// passport.deserializeUser(User.deserializeUser()) // just for local authentication

passport.serializeUser(function(user, done) { // works with any kind of authentication
  done(null, user.id);
});

passport.deserializeUser(function(id, done) { // works with any kind of authentication
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile)
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/', (req, res)=> {
    res.render('home')
})

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
)

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get('/register', (req, res)=> {
    res.render('register')
})

app.get('/login', (req, res)=> {
    res.render('login')
})

app.get('/secrets', (req, res)=> {
    User.find({'secret': {$ne: null}}, (err, foundUsers)=>{
        if(err){
            console.log(err)
        }else{
            res.render('secrets', {usersWithSecrets: foundUsers})
        }
    })
})

app.get('/logout', (req, res) => {
    req.logout()
    res.redirect('/')
})

app.get('/submit', (req, res)=> {
    if(req.isAuthenticated()){
        res.render('submit')
    }else{
        res.redirect('/login')
    }
})

app.post('/submit', (req, res)=> {
    const submittedSecret = req.body.secret
    console.log(req.user.googleId)

    User.findById(req.user.id, (err, foundUser)=> {
        if(err){
            console.log(err)
        }else{
            if(foundUser){
                foundUser.secret = submittedSecret
                foundUser.save(()=> {
                    res.redirect('/secrets')
                })
            }
        }
    })
})

app.post('/register', (req, res)=> {
        const newUser = new User ({
        email: req.body.username,
        password: req.body.password
    })
    newUser.save(err=>{
        if(err) {
            console.log(err)
        }else{
            res.render('secrets')
        }
    })
})

app.post('/login', (req, res)=> {
    const username = req.body.username
    const password = req.body.password
    User.findOne({email: username}, (err, foundUser)=> {
        if(err){
            console.log(err)
        }else{
            if(foundUser) {
                if(foundUser.password === password) {
                    res.render('secrets')
                }
            }
        }
    })
})


app.listen(3000, ()=> console.log('Server started on port 3000'))