  var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

//For sessions, it's dark magic
var session = require('express-session');
app.use(session({
  secret: 'WE CAN FLY!',
  resave: false,
  saveUninitialized: false
}));

//Session Time limit
var sessionTime = 60000;


app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));




app.use(function(req,res,next) {
  var currentUser = req.session.user;
      console.log(req.session.user, ':::currentUser');
  if(!req.session.user && req.url !== '/signup'){

    req.url = '/login';
  }else{
    // req.session.reload(function(err){
    //   if(err)console.log(err)
    //   // req.session.user = currentUser;
    //   req.session.cookie.expires = new Date(Date.now() + sessionTime);
    // });

  }
    next();
})


app.get('/',
function(req, res) {
  res.render('index');
});

app.get('/create',
function(req, res) {
  res.render('index');
});

app.get('/test', function (req, res){
  var test = "";

  Users.fetch().then(function(users){
    for(var i=0; i<users.models.length; i++){
      test += JSON.stringify(users.models[i].attributes) + "<br />";
    }
    res.send(200, test);
  });
});

app.get('/links',
function(req, res) {
  //if not logged in, redirect to login

  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links',
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      console.log('Found: '+uri);
      res.send(200, found.attributes);
    } else {
      console.log('NotFound: '+uri);

      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }
        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.post('/signup', function (req, res){
  new User({username:req.body.username, password: req.body.password}).save().then(function(newUser){
    //console.log(newUser);
    Users.add(newUser);
    res.redirect('/login');
  });

});
app.get('/signup', function (req, res){
  res.render('signup');
});
//--------------------------------------------------------------
app.get('/login', function (req, res){
  res.render('login');
});

app.post('/login', function (req, res){
  new User({username: req.body.username, password: req.body.password}).fetch().then(function(user){
    if(user){
      req.session.regenerate(function(err){
        if(err) { console.log(err); }else{
          req.session.user = req.body.username;
          console.log(Date.now(), sessionTime)
          req.session.cookie.expires = new Date(Date.now() + sessionTime);
          res.redirect('/');
        }
      });
    }else{
      console.log('Failed Login');
    }
  });
  // res.render('login');
});
//--------------------------------------------------------------
app.get('/logout', function (req, res){
  req.session.destroy(function (err){
    if(err) { console.log(err); }else{
      res.redirect('/login');
    }
  });

});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    //console.log(link);
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
