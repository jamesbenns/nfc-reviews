//  OpenShift sample Node application
var express = require('express'),
    fs      = require('fs'),
    app     = express(),
    hbs     = require('handlebars'),
    bodyParser = require('body-parser');

app.use(bodyParser.json()) // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

  }
}

var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  if (mongoURL == null) return;

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: ' + mongoURL);
  });
};

function renderToString(source, data) {
  var template = hbs.compile(source);
  var outputString = template(data);
  return outputString;
}

app.get('/review/:company', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var username = req.params.company;
    db.collection('companies').findOne({"username": username}, function(err, data){
        if(data){
            fs.readFile('views/index.hbs', function(err, file){
                if (!err) {
                    var source = file.toString();
                    res.end(renderToString(source, data));
                } else {
                    res.end('ERROR')
                }
            });
        } else {
            console.log(err);
            res.end('That company doesnt exist')
        }

    });


  } else {
    res.render('index.html', { pageCountMessage : null});
  }
});

app.post('/add/review', function(req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  } if(db){

    db.collection('reviews').insertOne(req.body, function(err, result) {

            if (err) throw err;

            db.collection('reviews').find({"company": req.body.company}, function(error, cursor){
            
                cursor.toArray(function(error, answer){
                    res.end(JSON.stringify(answer))
                })

            })


    });

  } 

});

app.get('/', function (req, res) {
    res.end('<p>choose a company!</p>');
});

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  var data = {"name": "james"}
  var template = hbs.compile('<h1>Something bad happened, {{name}}!</h2>');
  res.status(500).send(template(data));
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;