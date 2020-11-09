var schedule = require('node-schedule');
const Discord = require('discord.js');
const request = require('request');
const client = new Discord.Client();
const { JsonDB } = require('node-json-db');
const { Config } = require('node-json-db/dist/lib/JsonDBConfig');


var Users_db = new JsonDB(new Config("users_db", true, true, '/'));

const prefix = "!";

client.on("ready", () => {
    console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds. Ready at ${client.readyAt.toLocaleString("en-US", {timeZone: "Asia/Bangkok",hour12: false,weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"numeric",minute:"numeric",second:"numeric"})}`); 
    client.user.setActivity('🤔 !help', { type: 'LISTENING' });
});

client.on('message', async message => {
    if(message.author.bot) return;
    if(message.content.indexOf(prefix)!==0) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if( command == "check") {
      var NoData = false;
      try {
        var user_data = Users_db.getData("/users/"+message.author.id);
      } catch(error) {
        //console.log(error);
        NoData = true;    
      };
      if( NoData ) { //If you add add one
        message.channel.send("No data found creating... \nPlease input your Apex username");
        var ApexUserName = "";
        await message.channel.awaitMessages(m => m.author.id === message.author.id, { max: 1, time: 120000, errors: ["time"] })
        .then(collected => {
            if (collected.first().content.toLowerCase() === "cancel") {
                message.channel.send("You cancelled!!");
                cancel = true
                return;
            } else {
                ApexUserName = collected.first().content
            }
        }).catch((err) => {
            console.error(err)
            message.channel.send("Timed out, Next time please answer in 2 mins!!");
            cancel = true
            return;
        });
        if( ApexUserName.length == 0 ) {
          message.channel.send("Invalid username");
          return;
        }
        var userID = message.author.id;
        var ApexID = "";
        var LastedRank = "";
        var API_URL = "https://public-api.tracker.gg/apex/v1/standard/profile/5/" + ApexUserName;
        var isError = false;
        request({
          headers: {
            'TRN-Api-Key': 'TRN-TOKEN-HERE'
          },
          uri: API_URL,
          method: 'GET'
        }, function (err, res, body) {
          var data = JSON.parse(body)
          if (data.errors!=undefined) {
            var ErrList = []
            for (var i = 0; i < data.errors.length; i++) { 
              ErrList.push(data.errors[i].message)
            }
            message.channel.send(ErrList.join(" "));
            isError = true;
            return;
          } else {
            LastedRank = GetRankMMR(data.data.stats);
            const CurrentTime = Date.now();
            Users_db.push("/users",{
              [userID]: {
                  "ApexID": ApexUserName,
                  "Check": true,
                  "mmr": LastedRank,
                  "last_check": CurrentTime,
                  "DiscordID": message.author.id
              }
            } , false);
            message.channel.send(ApexUserName + " added to Database ( "+LastedRank+" MMR )")
          }
        });
      } else {
        var user_data = Users_db.getData("/users/"+message.author.id);
        var userID = message.author.id;
        var isCheck = user_data.Check;
        if( isCheck ) {
          Users_db.push("/users",{
            [userID]: {
                "Check": false
            }
          } , false);
          message.channel.send("Toggle off!");
        } else {
          Users_db.push("/users",{
            [userID]: {
                "Check": true
            }
          } , false);
          message.channel.send("Toggle on!");
        }
      }
    }
    
});

function GetRankMMR(stats) {
  for (var i = 0; i < stats.length; i++) {
    var key = stats[i].metadata.key
    if(key == "RankScore") {
      return stats[i].displayValue;
    }
  }
}

var CheckRank = schedule.scheduleJob('*/1 * * * *', async function() {
  var user_data = Users_db.getData("/users");
  for( var i in user_data ) {
    if( !user_data[i].Check ) continue;
    var ApexID = user_data[i].ApexID;
    var LastMMR = Number(user_data[i].mmr);
    var DiscordID = user_data[i].DiscordID;
    var API_URL = "https://public-api.tracker.gg/apex/v1/standard/profile/5/" + ApexID;
    request({
      headers: {
        'TRN-Api-Key': 'TRN-TOKEN-HERE'
      },
      uri: API_URL,
      method: 'GET'
    }, function (err, res, body) {
      var data = JSON.parse(body)
      if (data.errors!=undefined) {
        var ErrList = []
        for (var i = 0; i < data.errors.length; i++) { 
          ErrList.push(data.errors[i].message)
        }
        console.log(ErrList.join(" "));
        return;
      } else {
        var LastedRank = Number(GetRankMMR(data.data.stats));
        if( LastedRank != LastMMR ) {
          client.fetchUser(DiscordID).then(u => {
            if( LastedRank > LastMMR ) {
              u.send("Rank Up!! by " + (LastedRank - LastMMR) );
            } else {
              u.send("Brr Rank down by " + (LastedRank - LastMMR) );
            }
          });
          const CurrentTime = Date.now();
          Users_db.push("/users",{
            [DiscordID]: {
              "mmr": LastedRank,
              "last_check": CurrentTime
          }
          } , false);
        }
      }
    });
  }
});

client.login("DISCORD-TOKEN-HERE");
