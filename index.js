const ImageCharts = require('image-charts');
var schedule = require('node-schedule');
const Discord = require('discord.js');
const request = require('request');
const client = new Discord.Client();
const { JsonDB } = require('node-json-db');
const { Config } = require('node-json-db/dist/lib/JsonDBConfig');

var Users_db = new JsonDB(new Config("users_db", true, true, '/'));

const prefix = "!";

const Discord_TOKEN = "";
const ApexLeg_TOKEN = "";

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
      if( NoData ) { //If no data, add one
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
        var NewRank = "";
        var API_URL = "https://public-api.tracker.gg/apex/v1/standard/profile/5/" + ApexUserName;
        var isError = false;
        request({
          headers: {
            'TRN-Api-Key': ApexLeg_TOKEN
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
            NewRank = GetRankMMR(data.data.stats);
            const CurrentTime = Date.now();
            Users_db.push("/users",{
              [userID]: {
                  "ApexID": ApexUserName,
                  "Check": true,
                  "ranks_index": 1,
                  "ranks": [
                    {
                      "mmr": NewRank,
                      "timestamp": CurrentTime,
                      "RankName": data.data.metadata.rankName
                    }
                  ],
                  "mmr": NewRank,
                  "last_check": CurrentTime,
                  "DiscordID": message.author.id,
                  "RankName": data.data.metadata.rankName
              }
            } , false);
            message.channel.send(ApexUserName + " added to database with " + data.data.metadata.rankName + " ( "+NewRank+" MMR )")
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

    if(command == "rank") {
      var ApexName = "";
      if(args[0]==undefined){ //If no name find it's in db.
        var NoData = false;
        try {
          var user_data = Users_db.getData("/users/"+message.author.id);
        } catch(error) {
          NoData = true;    
        };
        if(!NoData) {
          var user_data = Users_db.getData("/users/"+message.author.id);
          ApexName = user_data.ApexID;
        }
      } else {
        ApexName = args[0];
      }
      var API_URL = "https://public-api.tracker.gg/apex/v1/standard/profile/5/" + ApexName
      request({
        headers: {
          'TRN-Api-Key': ApexLeg_TOKEN
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
          message.channel.send(ErrList.join(" "))
        } else {
          const exampleEmbed = new Discord.RichEmbed()
            .setColor('#154897')
            .setTitle(data.data.metadata.rankName)
            .setAuthor(data.data.metadata.platformUserHandle, data.data.metadata.avatarUrl)
            .setDescription(data.data.metadata.rankName + " ( " + GetRankMMR(data.data.stats) + " MMR ), Level: " + GetLevel(data.data.stats))
            .setThumbnail(data.data.metadata.rankImage)
            .setTimestamp(message.createdAt)
            .setFooter('API by https://tracker.gg', 'https://tracker.gg/public/icons/tile310.png');
  
          message.channel.send(exampleEmbed);
        
        }
      });
    }
    
    // Return graph of rank in 1 day
    if(command == "last1d") {   
      var NoData = false;
      try {
        var user_data = Users_db.getData("/users/"+message.author.id);
      } catch(error) {
        //console.log(error);
        NoData = true;    
      };
      if( NoData ) {
        message.channel.send("No data...");
        return;
      } else {
        var user_data = Users_db.getData("/users/"+message.author.id);
        var Data = GetChartData(user_data.ranks, 24);
        const chart = ImageCharts()
          .cht('lxy')
          .chd(Data.chd)
          .chs("700x325")
          .chco("76A4FB")
          .chls("2.0")
          .chxt("y")
          .chxr(Data.chxr)
          .chtt("24 Hour Overview of " + user_data.ApexID);
          message.channel.send(chart.toURL());
      }
    }

    if(command == "last1h") {   
      var NoData = false;
      try {
        var user_data = Users_db.getData("/users/"+message.author.id);
      } catch(error) {
        //console.log(error);
        NoData = true;    
      };
      if( NoData ) {
        message.channel.send("No data...");
        return;
      } else {
        var user_data = Users_db.getData("/users/"+message.author.id);
        var Data = GetChartData(user_data.ranks, 1);
        const chart = ImageCharts()
          .cht('lxy')
          .chd(Data.chd)
          .chs("700x325")
          .chco("76A4FB")
          .chls("2.0")
          .chxt("y")
          .chxr(Data.chxr)
          .chtt("1 Hour Overview of " + user_data.ApexID);
          message.channel.send(chart.toURL());
      }
    }
});

function GetRankMMR(stats) {
  for (var i = 0; i < stats.length; i++) {
    var key = stats[i].metadata.key
    if(key == "RankScore") {
      var MMR = stats[i].displayValue;
      MMR = MMR.replace(",", "");
      MMR = parseInt(MMR);
      return MMR;
    }
  }
}

function GetChartData(ranks, hour) {
  var CurrentTime = Date.now();
  var StartTime = CurrentTime - ( hour*60*60*1000 );
  var Xformat = "t:";
  var Yformat = "";
  var mmrList = [];
  for( var i=ranks.length-1; i>=0; i-- ) {
    // If rank is between start and current time
    if( ranks[i].timestamp > StartTime ) {
      Xformat += (ranks[i].timestamp-StartTime) + ",";
      Yformat += ranks[i].mmr + ",";
      mmrList.push(ranks[i].mmr);
    } else {
      break;
    }
  }

  var mmrMax = Math.max(...mmrList);
  mmrMax = 50 * (Math.ceil(mmrMax/50)+1);
  var mmrMin = Math.min(...mmrList);
  mmrMin = 50 * (Math.floor(mmrMin/50)-1);

  // If rank is empty
  if( Xformat == "t:") {
    mmrMin = 0;
    mmrMax = 3000;
    Xformat += "0,";
    Yformat += "0,";
  }

  Xformat = Xformat.slice(0, -1);
  Yformat = Yformat.slice(0, -1);

  return {
      chd: Xformat + "|" + Yformat,
      chxr: "0," + mmrMin + "," + mmrMax
  }
}

function GetLevel(stats) {
  for (var i = 0; i < stats.length; i++) {
    var key = stats[i].metadata.key
    if(key == "Level") {
      return stats[i].displayValue;
    }
  }
}

// Update database every 1 min
var CheckRank = schedule.scheduleJob('*/1 * * * *', async function() {
  var user_data = Users_db.getData("/users");

  // loop every users
  for( var i in user_data ) {
    var ApexID = user_data[i].ApexID;
    var DiscordID = user_data[i].DiscordID;
    var OldMMR = user_data[i].mmr;
    var RanksIndex = user_data[i].ranks_index;

    // Request rank from TRN api
    var API_URL = "https://public-api.tracker.gg/apex/v1/standard/profile/5/" + ApexID;
    request({
      headers: {
        'TRN-Api-Key': ApexLeg_TOKEN
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
        var NewMMR = GetRankMMR(data.data.stats);
        if( OldMMR != NewMMR ) {
          var CurrentTime = Date.now();
          var NewRanksIndex = RanksIndex + 1;
          Users_db.push("/users",{
            [DiscordID]: {
              "ranks_index": NewRanksIndex,
              "mmr": NewMMR,
              "last_check": CurrentTime,
              "RankName": data.data.metadata.rankName
            }
          } , false);
          Users_db.push("/users/"+DiscordID+"/ranks["+RanksIndex+"]",{
            "mmr": NewMMR,
            "timestamp": CurrentTime,
            "RankName": data.data.metadata.rankName
          } , true);
        }
      }
    });
  }
});

client.login(Discord_TOKEN);
