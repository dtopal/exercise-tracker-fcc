const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/exercise-track' )
mongoose.Promise = global.Promise;

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Schema and model
var Schema = mongoose.Schema;

var exerciseSchema = new Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now() }
});

var userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  log: [exerciseSchema]
});

var User = mongoose.model("User", userSchema);

// add user middleware
app.post("/api/exercise/new-user", (req, res, next) => {
  var user = new User({ username: req.body.username });
  //console.log(user);
  var addUser = user.save((err, data) => {
    if (err) {
      // reject duplicate usernames
      if(err.code === 11000) {
        return res.status(400).type('txt').send('username already take');
      }
      //console.log(err);
      return next(err);
    } else {
      //console.log(data);
      res.json({ username: data.username, _id: data._id });
    }
  });
})

// get all users
app.get("/api/exercise/users", (req, res, next) => {
  var query = User.find({});
  query.exec((err, data) => {
    if (err) {
      return next(err);
    }
    res.json(data.map(user => ({
      _id: user._id,
      username: user.username
    })));
  })
});

// post exercise to user middleware
app.post("/api/exercise/add", (req, res, next) => {
  var curr = {
    description: req.body.description,
    duration: req.body.duration,
    date: req.body.date
  };
  if (curr.date) {
    curr.date = new Date(curr.date);
  } else {
    curr.date = new Date();
  }
  
  var options = {
    new: true,
    useFindAndModify: false
  };
  var update = User.findByIdAndUpdate(req.body.userId, { $push: { log: curr } }, options, (err, data) => {
    if (err) {
      return next(err);
    }
    //console.log(curr);
    res.json({ username: data.username, description: curr.description, duration: curr.duration, _id: data._id, date: curr.date.toDateString() });
  })
  
})

// get exercise logs by userId
app.get("/api/exercise/log", (req, res, next) => {
  var user = User.findById(req.query.userId).exec((err, data) => {
    if (err) {
      console.log(err);
      return next(err);
    }
    if (data == null) {
      return res.type('txt').send('unknown userId');
    }
    var exercises = data.get('log').sort('date');
    
    // TO-DO check to see if date is a valid format ----- regex?
                                                 
    if (req.query.from) {
      exercises = exercises.filter(x => (x.date >= new Date(req.query.from)));
    }
    if (req.query.to) {
      exercises = exercises.filter(x => x.date < new Date(req.query.to));
    }
    
    //limit number of exercises in user log
    var limit = req.query.limit;
    if (limit) {
      console.log('limit = ' + limit);
      exercises = exercises.slice(0, limit);
    }
    
    console.log(data);
    exercises = exercises.map(x => ({ description: x.description, duration: x.duration, date: x.date.toDateString() }));
    res.json({ username: data.username, _id: data._id, count: data.log.length, log: exercises });
  })
})


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
