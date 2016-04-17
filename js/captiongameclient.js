var gameid = window.location.pathname.split("/play")[1];
var socket = io();
socket.emit('joinGame',{gameid: gameid});

socket.on('gameStart', function(data) {
  console.log("Game started!");
  $("audio")[0].play();
});

socket.on('nextRound', function(roundInfo) {
  console.log(roundInfo);
  startRound(roundInfo);
});

socket.on('invalidSentence', function(msg) {
  // TODO: notify user
  if (msg.empty) {
    console.error("Sentence was rejected because it was empty");
  } else {
    console.error("Sentence was rejected because of the following words:", msg.invalidWords);
  }
});

socket.on('sentenceAccepted', function() {
  // TODO: notify user
  console.log("Sentence was accepted!");
});

socket.on('gameEnd', function(data) {
  $('#winningSentence').text(data.sentence);
  showRound("winner");
  console.log("Game over!")
});

function doGame() {
  socket.emit('startGame',{gameid: gameid})
}

function startTimer(duration) {
  $(".timer:visible").width('100%')
  $(".timer:visible").animate(
    {
      width: '0px'
    },
    {
      easing:'linear',
      duration: duration,
      progress: function(anim,progress,remainingMs) {
        $(".timeRemaining").text(Math.round(remainingMs/100)/10 + " s");
      }
    }
  )
}

var roundids = ["word","image","vote","winner"];
function showRound(id) {
  $(".roundContainer").hide();
  $("#"+id+"RoundContainer").fadeIn({duration: 300});
}

function startRound(roundInfo) {
  roundNumber = roundInfo.roundNumber;
  expireTime = roundInfo.expireTime;
  if (roundInfo.image != "") {
    $(".roundImage").attr("src",roundInfo.image);
  }
  showRound(roundids[roundNumber-1]);
  now = (new Date()).getTime()
  dt = expireTime>now ? expireTime - now : 0;
  startTimer(dt);
}

var freebies;
$(function() {
  $.getJSON({
    url:"/static/freebies.json",
    success: function(data) {
      freebies = data.freebieWords;
      freebies.forEach(function(e){
        $("#freebieDropdownBody").append($('<a style="width: 50%" class="btn btn-primary btn-lg" role="button">' + e + '</a>'));
      })
      // console.log("freebie words:",freebies);
    }
  })

  var generatedSentences = ["First","Second","Third","Fourth","Fifth"]
  generatedSentences.forEach(function(e,i,a){
    $("#userGeneratedSentences").append($('<a class="center-block btn btn-primary btn-md" data-votenumber='+ i+1 + ' role="button">' + e + '</a>'));
  })

  var playerWords = ["Fat","Ugly","Bad","Diabetic","Dumb"]
  //var test = ;
  //Populate the player wordbank
  playerWords.forEach(function(e){
    $("#playerWordBank").append($('<a style="width: 50%" class="btn btn-primary btn-lg" role="button">' + e + '</a>'));
  })

  var globalWordBank = ["Fat","Ugly","Bad","Diabetic","Dumb","Corpulent","Doge","Red","Blue","Orange","Soggy","Sad","Opulent","Regal","Flacid"]
  globalWordBank.forEach(function(e){
    $("#globalWordBank").append($('<a style="width: 50%" class="btn btn-primary btn-lg" role="button">' + e + '</a>'));
  })

  // extract button word
  $('#playerWordBank').on('click', '.btn',function() {
    input = $("#userSentence");
    word = $(this).text();
    if ( input.val().indexOf(word) < 0 ) {
      // check if there's already a space with ternary
      hasSpace = input.val().length == 0 || input.val().substr(-1,1) == " ";
      input.val( input.val() + (hasSpace ? "" : " ") + word + " " );
    }
  });

  $('#freebieDropdownBody').on('click', '.btn',function() {
    input = $("#userSentence");
    word = $(this).text();
    // check if there's already a space with ternary
    hasSpace = input.val().length == 0 || input.val().substr(-1,1) == " ";
    input.val( input.val() + (hasSpace ? "" : " ") + word + " " );
    $('#myModal').modal('hide');
  });

  $("#submitSentence").on('click',function(){
    input = $("#userSentence");
    socket.emit('sendSentence',{ sentence: input.val(), gameid: gameid });
  });

  $('#userGeneratedSentences').on('click', '.btn',function(){
     console.log("vote button pressed");
     btn = $(this);
     console.log(btn);
     console.log(btn.data()['votenumber']);
     socket.emit('voteSentence',{ sentence: btn.text(), voteFor: btn.data()['votenumber'], gameid: gameid });
  });

  $('#globalWordBank').on('click', '.btn',function(){
     btn = $(this);
     socket.emit('draftWord',{ sentence: btn.text(), gameid: gameid });
  });
})
