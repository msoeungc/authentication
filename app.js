require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

//  important to place code here above mongo connect and below setup for express, ejs, and bodyParser
app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

// use and initializing passport for sessions
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  secret: String
});

// plugin used to hash and salt our passwords.  Must be used on mongoose schema
userSchema.plugin(passportLocalMongoose);
// plugin for findOrCreate function to use with passport
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

// code to setup and use passport-local-mongoose
passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// Code from passport-google
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_GOOGLE_ID,
    clientSecret: process.env.CLIENT_GOOGLE_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.CLIENT_FB_ID,
    clientSecret: process.env.CLIENT_FB_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOrCreate({facebookId: profile.id}, function(err, user) {
      if (err) { return done(err); }
      done(null, user);
    });
  }
));

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/auth/google",
// using passport to authenticate using the google strategy we set up ^^^ and we want the user's profile on google
  passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets page.
    res.redirect('/secrets');
  });

  // Redirect the user to Facebook for authentication.  When complete,
// Facebook will redirect the user back to the application at
//     /auth/facebook/callback
app.get("/auth/facebook", passport.authenticate("facebook"));

// Facebook will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
app.get("/auth/facebook/secrets",
  passport.authenticate('facebook', { successRedirect: "/secrets", failureRedirect: "/login" }));

app.post("/register", function(req, res) {

  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      // authenciate method from passport
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });

});

app.post("/login", function(req, res) {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  })
  // login method from passport
  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      // authenicate method from passport, creates cookie that user is authenticated and breaks when session ends
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });

});

app.get("/secrets", function(req, res) {
  // Look through collection of users check secret field and pick out users where the secret field is not equal to null
  User.find({"secret": {$ne: null}}, function(err, foundUsers) {
    if (err) {
      console.log(err);
    } else {
      if (foundUsers) {
        // render secrets page and pass in var usersWithSecrets
        res.render("secrets", {usersWithSecrets: foundUsers});
      }
    }
  });
});

app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function(req, res) {
  const submittedSecret = req.body.secret;

  console.log(req.user.id);

  User.findById(req.user.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(function() {
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.get("/logout", function(req, res) {
  // logout method from passport
  req.logout();
  res.redirect("/");
})

app.listen(3000, function() {
  console.log("Server started on port 3000.")
});
