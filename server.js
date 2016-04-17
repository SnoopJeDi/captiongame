var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 80;

var fs = require('fs');
var freebies = [];
var games = {};
var sendPlayersReady;

fs.readFile('freebies.json', 'utf8', function (err, data) {
  if (err) throw err;
  freebies = JSON.parse(data).freebieWords;
});

app.set('port', port);
server.listen(port);

app.use('/static/',express.static(__dirname))
//app.use('/',express.static(__dirname))
app.get("/play*", function(req,res) {
   res.sendFile(__dirname + '/index.html');
 });

io.on('connection', function(socket){
    // console.log('client connected (id: ' + socket.id +' )');
    socket.on('disconnect', function(){
      // console.log('client disconnected (id: ' + socket.id +' )');
      gameid = socket.gameid;
      if ( typeof(gameid) != "undefined" ) { // if this socket has had anything to do with a game, remove them
        delete(games[gameid].players[socket.id]);
        delete(games[gameid].playersReady[socket.id]);
        sendPlayersReady(gameid);
      }
    });

    socket.on('joinGame', function(msg) {
      gameid = msg.gameid;
      console.log("Client " + socket.id + " is joining game with id " + gameid);
      // console.log(games[gameid]);
      socket.join(gameid);
      socket.gameid = gameid;
      // console.log(gameid);
      if (typeof(games[gameid]) == "undefined") {
        game = new captionGame(gameid);
        games[gameid] = game;
      }
      games[gameid].players[socket.id] = "Enigma"; // Default username until a player readies up
      console.log(Object.keys(games[gameid].players));
      sendPlayersReady(gameid);
    });

    sendPlayersReady = function (gameid) {
        if ( typeof(games[gameid]) == "undefined" ) {
          return false;
        }
        if ( games[gameid].running == "stale" ) {
          games[gameid].playersReady = {};
          games[gameid].running = false;
        }
        readyPlayers = Object.keys(games[gameid].playersReady).length;
        numPlayers = Object.keys(games[gameid].players).length;
       io.to(gameid).emit("playersReady",{
        readyPlayers: readyPlayers,
        numPlayers: numPlayers
       });
       if( numPlayers > 1 && readyPlayers == numPlayers ) {
         games[gameid].startGame(gameid);
       }
     }
    socket.on('playerReady', function(msg) {
      if (!games[msg.gameid].running) { // if the game isn't already going
        console.log("Socket " + socket.id + " has playerName " + msg.playerName );
        // console.log( io.nsps['/'].adapter.rooms[msg.gameid] );
        games[msg.gameid].players[socket.id] = msg.playerName;
        games[msg.gameid].playersReady[socket.id] = true;
        sendPlayersReady(msg.gameid);
      }
    });
    // TODO: ready mechanism?
    // socket.on('startGame', function(){
    //   console.log("Received request from " + socket.id + " to start a game cycle");
    //   game.startGame(socket.gameid);
    // });
    socket.on('voteSentence', function(msg){
      if (typeof(games[msg.gameid]) == "undefined" ) {
        console.error("Unknown game")
      }

//      games[msg.gameid].votes[msg.voteFor] = typeof(games[msg.gameid].votes[msg.voteFor]) == "undefined" ? 1 : games[msg.gameid].votes[msg.voteFor] + 1;
      games[msg.gameid].sentences[msg.voteFor-1].votes += 1;
      console.log("Vote for ",msg.voteFor, games[msg.gameid].sentences );
    });
    socket.on('sendSentence', function(msg) {
      //console.log("Message from " + socket.id);
      // TODO: not hard-coded, but seeded from the word draft round
      playerWords = [
        "cupcake",
        "doge",
        "sweet",
        "diabetic",
        "fat",
        "yellow",
        "dumb"
      ];
      words = msg.sentence.split(' ').filter(function(s) { return s!=""; });
      // badwords = words.filter(function(s){
      //   return freebies.concat(playerWords).indexOf(s.toLowerCase())<0;
      // });
      // if (badwords.length>0 || words.length == badwords.length) {
      //   socket.emit('invalidSentence',{
      //     sentence: msg.sentence,
      //     invalidWords: badwords,
      //     empty: (words.length == 0)
      //   });
      // }
      if (words.length>0) {
        socket.emit('sentenceAccepted');
        games[msg.gameid].sentences = [].concat(games[msg.gameid].sentences,{sender:socket.id, sentence:msg.sentence, votes:0});
        console.log("Sentences stored ",games[msg.gameid].sentences);
      }
    });
});

lazyClone = function(obj) {
  return JSON.parse(JSON.stringify(obj));
}
var imageDB = [
  "Doge_Image.jpg",
  "rarepepe.png",
  "CWlEICI.jpg",
  "VjFr1P4.jpg",
  "people-q-c-640-480-2.jpg",
  "business-q-c-640-480-10.jpg",
  "mbfl9fC.jpg",
  "RsNtSyo.jpg",
  "desktop-hd-funny-dog-pics-with-sayings.jpg",
  "awg5Ccr.png",
  "4tQN7x7.jpg"
];
captionGame = function(gameid) {
    return {
      running: false,
      numRounds: 3,
      roundDuration: [0,30000,20000],
      currentRound : 1,
      gameid: gameid,
      image: "/static/"+imageDB[ Math.floor( imageDB.length*Math.random() ) ], // randomly chosen image from our DB
      votes: [],
      sentences: [],
      //players: lazyClone(io.nsps['/'].adapter.rooms[gameid].sockets), // list of players in this room
      players: {},
      playersReady: {},
      votingPool: [],
      results: [],


      startGame : function () {
        console.log("Starting game with gameid ",this.gameid);
        console.log("The player list is ",this.players);
        this.running=true;
        io.to(this.gameid).emit('gameStart');
        var self = this;
        self.nextRound();

      },
      nextRound : function () {
        if (this.currentRound >= this.numRounds) {
          this.endGame();
        } else {
          this.currentRound += 1;
          // console.log("Going to round " + this.currentRound);
          if(this.sentences.length>0){
            this.sentences.forEach( function(e,i,a) { this.votingPool = this.votingPool.concat(e.sentence); console.log(this.votingPool) }, this );
          }
          io.to(this.gameid).emit('nextRound',{
            roundNumber: this.currentRound,
            expireTime: (new Date()).getTime() + this.roundDuration[this.currentRound-1],
            image: this.currentRound > 1 ? this.image : "",
            votingPool: this.votingPool
          });
          var self = this;
          setTimeout(function() { self.nextRound() },self.roundDuration[self.currentRound-1]);
        }
      },
      endGame : function () {
        console.log("Game over!");
        console.log(this.votes);
        winner = "Nobody!";
        sentence = "I have no mouth, and I must scream";
        maxvotes = 0;
        var sorted = this.sentences.sort( function(a,b) {
          if( a.votes > b.votes ) {
            return 1;
          } else if ( a.votes < b.votes ) {
            return -1;
          } else {
            return 0;
          }
        })
        win = sorted.pop();
        while( typeof(win) == "undefined" || typeof(win.sender) == "undefined" || typeof(this.players[win.sender]) == "undefined" ) {
          win = sorted.pop();
        }
        winner = this.players[win.sender];
        sentence = win.sentence;
        var popped;
        while( popped = sorted.pop() ) {
          if ( win.votes == popped.votes ) {
            winner = "A tie!";
            sentence = [].concat(sentence,popped.sentence);
          } else {
            break;
          }
        }
        console.log(win);

        // Object.keys(this.sentences).forEach( function(e,i,a) { this.results[i] = 0; }, this);
        // for ( prop in this.votes ) {
        //   console.log(prop);
        //   console.log(this.votes[prop]);
        //   console.log(this.results[this.votes[prop]]);
        //   if ( this.votes.hasOwnProperty(prop) ) {
        //     this.results[this.votes[prop]] += 1;
        //     if (this.results[this.votes[prop]] > maxvotes) {
        //       console.log(this.votes[prop] +" has overtaken the previous max");
        //       maxvotes = this.results[this.votes[prop]];
        //       winner = this.players[prop];
        //       sentence = this.sentences[prop];
        //     } else if (this.results[this.votes[prop]] == maxvotes ) {
        //       winner = "A tie!"
        //       sentence = [].concat(sentence,this.sentences[prop]);
        //     }
        //   }
        // }

        io.to(this.gameid).emit('gameEnd',{winner: winner, sentence: sentence});

        this.playersReady = {};
        this.running=false;
        this.numRounds= 3;
        this.currentRound = 0;
        this.gameid= gameid;
        this.image= "/static/"+imageDB[ Math.floor( imageDB.length*Math.random() ) ]; // randomly chosen image from our DB
        this.votes= {};
        this.sentences= {};
        //players: lazyClone(io.nsps['/'].adapter.rooms[gameid].sockets), // list of players in this room
        this.players= {};
        this.playersReady= {};
        this.votingPool= [];
        this.results= [];
        sendPlayersReady();
      }
    };
};
