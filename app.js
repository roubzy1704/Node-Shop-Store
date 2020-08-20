require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const flash = require("connect-flash");
const helmet = require("helmet");
var compression = require("compression");
const morgan = require("morgan");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");
const errorController = require("./controllers/error");
const User = require("./models/user");

const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-te3j2.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`;

const app = express();
//storing session in a collection using connect-mongodb-session package
const store = new MongoDBStore({
	uri: MONGODB_URI,
	collection: "sessions",
});
// setup csrf middleware
const csrfProtection = csrf();

//EJS view engine
app.set("view engine", "ejs");
app.set("views", "views");

//Helmet helps you secure your Express apps by setting various HTTP headers
app.use(
	helmet({
		//set contentSecurityPolicy to false to allow image URL usage
		contentSecurityPolicy: false,
	})
);
// compress all responses
app.use(compression());
//logger middleware function
//first create a file to store log information
//creat writestream to access.log
const accessLogStream = fs.createWriteStream(
	path.join(__dirname, "access.log"),
	{ flags: "a" }
);
//morgan middle, with writestream to accesslogstream
app.use(morgan("combined", { stream: accessLogStream }));

app.use(bodyParser.urlencoded({ extended: false }));
//to servee up static files like css
app.use(express.static(path.join(__dirname, "public")));
//session middleware
app.use(
	session({
		secret: "my secret",
		resave: false,
		saveUninitialized: false,
		store: store,
	})
);
//after we initialize the session above
app.use(csrfProtection);

//initialize flash
app.use(flash());

//set local variable on all res.render like isAuthenticated and csrfToken
app.use((req, res, next) => {
	res.locals.isAuthenticated = req.session.isLoggedIn;
	res.locals.csrfToken = req.csrfToken();
	next();
});

//* CHECK HERE FOR SESSION VALIDATION, USING LECTURE SECTION 14, 244
app.use((req, res, next) => {
	// throw new Error('Sync Dummy');
	if (!req.session.user) {
		return next();
	}
	User.findById(req.session.user._id)
		.then((user) => {
			if (!user) {
				return next();
			}
			req.user = user;
			next();
		})
		.catch((err) => {
			next(new Error(err));
		});
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get("/500", errorController.get500);

app.use(errorController.get404);

app.use((error, req, res, next) => {
	// res.status(error.httpStatusCode).render(...);
	// res.redirect('/500');
	res.status(500).render("500", {
		pageTitle: "Error!",
		path: "/500",
		isAuthenticated: req.session.isLoggedIn,
	});
});

mongoose
	.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
	.then((result) => {
		app.listen(process.env.PORT || 4000);
	})
	.catch((err) => {
		console.log(err);
	});
