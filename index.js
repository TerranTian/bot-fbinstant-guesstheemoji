'use strict';

const VERIFY_TOKEN = 'EAABfV8cX80ABAAg1lQCbhTiEhZCdTZAK9M5tkxLGcZAjFOw9ZBSatQ4HdHOQvNtn90AYvtQJhdM0llQ69yPga9EIlEfDGMUBUZBqlrnfzutTn6HIAIFJ7iSo9sFpuFrRZB8sYZBZBbrz0c3DBhrPHbA3OoGQhGYN9MmZCETS6lZBVMrQZDZD';
const MONGODB_URL = 'mongodb://localhost:27017/';
const DB_NAME = 'botDB';
const PLAYERS_COLLECTION_NAME = 'playersCollection';

var arrMessageReminders = [
{
    title: "😍 We miss you! 😍",
    message: "Time to relax! 😏 Come back to play and solve some levels...🤘"
},
{
    title: "Time to relax...😍'",
    message: "If you feel tired 😪 Let's play and solve some puzzle for relax and get fun! 🤘"
},
{
    title: "Your friends waiting you...😤",
    message: "Some your friends playing game now 🤘 Join and beat them! 😎"
},
{
    title: "Do you know? 🤗",
    message: "More than 20% players can't reach level 100. Can you reach level 100? 😎"
},
{
    title: "1400 levels waitting...😱",
    message: "🤣 I think you can  solve all levels. Let's play now! 😎"
},
];

const
    moment = require('moment'),
    mongo = require('mongodb'),
    request = require('request'), 
    express = require('express'),
    https = require("https"),
    fs = require("fs"),
    bodyParser = require('body-parser'),
    app = express().use(bodyParser.json());


var counterSendPush = 0;

var MongoClient = mongo.MongoClient;
var MongoDB = null;
MongoClient.connect(MONGODB_URL, function(err, client) {
    if (!err){
        console.log("Connected MongoDB success!");
        MongoDB = client.db(DB_NAME);

        //Run checking every 1 hours
        setInterval(checkAndSendMessageForAllPlayers, 1800000);
        //checkAndSendMessageForAllPlayers();
    }
    else{
        console.error(err);
    }
           
});

const sslOptions = {
    key: fs.readFileSync('yolostudio_xyz.key'),
    cert: fs.readFileSync('yolostudio_xyz.crt'),
    ca: fs.readFileSync('yolostudio_xyz.ca-bundle')
};

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
// Sets server port and logs message on success
https.createServer(sslOptions, app).listen(process.env.PORT || 1337, () => console.log('Webhook Guess The Emoji - Port 1337 is listening...'));
//app.listen(process.env.PORT || 1337, () => console.log('webhook localhost is listening'));

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
 
    let body = req.body;
  
    // Checks this is an event from a page subscription
    if (body.object === 'page') {
        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {
            // Gets the message. entry.messaging is an array, but 
            // will only ever contain one message, so we get index 0
            let webhook_event = entry.messaging[0];
            if (webhook_event.game_play) {
                onReceivedGameplay(webhook_event);    
            }
              
        });
  
        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {  
    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];
      
    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);      
        }
    }    
});

app.get('/limited_reward', (req, res) => {  
    let playerID = req.query['player_id'];
    if(isPlayerCanGetLimitedReward(playerID)){
        res.status(200).json({errCode: 0, success: true});  
    }
    else{
        res.status(200).json({errCode: -1, success: false});  
    }
});

function onReceivedGameplay(event){
    // Page-scoped ID of the bot user
    var senderId = event.sender.id; 

    // FBInstant player ID
    var playerId = event.game_play.player_id; 

    // FBInstant context ID 
    var contextId = event.game_play.context_id;

    if(MongoDB){
        addPlayerToCollection(senderId, playerId);
    }

    // // Check for payload
    // if (event.game_play.payload) {
    //     // The variable payload here contains data set by
    //     // FBInstant.setSessionData()
    //     //
    //     var payload = JSON.parse(event.game_play.payload);

    //     // In this example, the bot is just "echoing" the message received
    //     // immediately. In your game, you'll want to delay the bot messages
    //     // to remind the user to play 1, 3, 7 days after game play, for example.
    //     sendMessage(senderId, null, "Message to game client: '" + payload.message + "'", "Play now!", payload);
    // }
    // else{
       
    // }
};

// Send bot message
//
// sender (string) : Page-scoped ID of the message recipient
// context (string): FBInstant context ID. Opens the bot message in a specific context
// message (string): Message text
// cta (string): Button text
// payload (object): Custom data that will be sent to game session
// 
function sendMessage(senderID, contextID, title, message, urlImg, cta, payload) {
    var button = {
        type: "game_play",
        title: cta
    };

    if (contextID) {
        button.context = contextID;
    }

    if (payload) {
        button.payload = JSON.stringify(payload)
    }

    var messageData = {
        recipient: {
            id: senderID
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [
                    {
                        title: title,
                        subtitle: message,
                        image_url: urlImg,
                        buttons: [button]
                    }
                    ]
                }
            }
        }
    };

    callSendAPI(messageData);

};

function sendMessageWithLimitedGift(senderID, contextID){
    var valueBonusCoin = 200;
    var title = '😱 Limited Gift 😱';
    var message = "Don't miss it! Enter game to claim " + valueBonusCoin + " coins! Only in 12 hours! 😎";
    var urlImg = 'https://image.ibb.co/kutuZS/1200_627_limited_gift.jpg'
    var cta = 'Claim & Play Now';

    sendMessage(senderID, contextID, title, message, urlImg, cta, { event: 'claim_coins' });
};

function sendMessageReminderToPlay(senderID, contextID){
    var rndMessage = randomItemArray(arrMessageReminders);

    var title = rndMessage.title;
    var message = rndMessage.message;
    var urlImg = 'https://image.ibb.co/k3TAW7/1200_627_reminder.jpg'
    var cta = 'Play Now';

    sendMessage(senderID, contextID, title, message, urlImg, cta, null);
};

function sendMessageSubscribe(senderID, contextID){
    var title = 'Nice to meet you! 👋';
    var message = "I'm Bot! I'll notify you when have gifts or new updates! Have a nice day!";
    var urlImg = 'https://image.ibb.co/k3TAW7/1200_627_reminder.jpg'
    var cta = 'Play Now';

    sendMessage(senderID, contextID, title, message, urlImg, cta, null);
};

function callSendAPI(messageData) {
    var graphApiUrl = 'https://graph.facebook.com/me/messages?access_token=' + VERIFY_TOKEN;
    request({
        url: graphApiUrl,
        method: "POST",
        json: true,  
        body: messageData
    }, function (error, response, body){
        // if(error)
        //     console.error('Send FB Graph API failed ', 'error', error, 'status code', response.statusCode, 'body', body);
        // else
        //     console.log('Send FB Graph API successed!');
    });
};

function addPlayerToCollection(senderID, playerID){
    var collection = MongoDB.collection(PLAYERS_COLLECTION_NAME);  
    if(collection){
        var query = {sender_id: senderID};
        collection.find(query).toArray(function(err, result) {
            if(!err){
                if(result.length == 0){
                    var player = { sender_id: senderID, player_id: playerID, last_datetime_send_push: moment() };
                    collection.insertOne(player, function(err, res) {
                        if (!err){
                            console.log("[" + moment().format('LLL') + "]" + " Added new player with sender id: " + senderID);
                            sendMessageSubscribe(senderID, null);
                        }                           
                        else
                            console.error(err);
                    });
                }
                else{
                    //console.log('Player already in database!');
                    //sendMessageSubscribe(senderID, null);
                }
            }
        }); 
    }
};

function checkAndSendMessageForAllPlayers(){
    var collection = MongoDB.collection(PLAYERS_COLLECTION_NAME);
    if(collection){
        counterSendPush = 0;
        collection.find().forEach(function(doc){
            var curDateTime = moment();
            var diff = curDateTime.diff(moment(doc.last_datetime_send_push), 'minute');
            //>= 12 hours
            if((diff + 1) >= 1440){
                sendMessageWithLimitedGift(doc.sender_id, null);
                collection.update({_id: doc._id}, {$set: {last_datetime_send_push: curDateTime}});
                counterSendPush += 1;    
            }                
        });
        console.log("[" + moment().format('LLL') + "]" + " Check and send message. Sent total: " + counterSendPush + " players!");
    }
};

function isPlayerCanGetLimitedReward(playerID){
    var collection = MongoDB.collection(PLAYERS_COLLECTION_NAME);  
    if(collection){
        var query = {player_id: playerID};
        collection.findOne(query, function(err, docPlayer) {
            if(!err && docPlayer){
                var curDateTime = moment();
                var diff = curDateTime.diff(moment(docPlayer.last_datetime_send_push), 'minute');
                if((diff + 1) <= 720){
                    return true;
                }
                else
                    return false;
            }
        });
    }

    return false;
}

function randomItemArray(array){
    return array[Math.floor(Math.random() * array.length)];   
}