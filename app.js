require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

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
  password: String
});

// plugin used to hash and salt our passwords.  Must be used on mongoose schema
userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

// code to setup and use passport-local-mongoose
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/login", function(req, res) {
  res.render("login");
});



app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/secrets", function(req, res) {
  // isAuthenticated method from passport
  if (req.isAuthenticated()) {
    res.render("secrets");
  } else {
    res.redirect("/login");
  }
});

app.get("/submit", function(req, res) {
  res.render("submit");
});

app.get("/logout", function(req, res) {
  // logout method from passport
  req.logout();
  res.redirect("/");
})

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






app.listen(3000, function() {
  console.log("Server started on port 3000.")
});
