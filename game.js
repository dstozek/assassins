var fs = require('fs');
var _ = require('underscore');


var DefaultRules = load_rules('game_rules.json');

function load_rules(fn) {
    return JSON.parse(fs.readFileSync(__dirname + '/' + fn, {encoding: 'utf-8'}));
}

var Game = function(players, rules) {
    
    var self = {
        players: players.slice(0),
        
        whose_turn: null,
        rules: rules || DefaultRules
    };
    
    
    
    self.remove_player = function(p) {
        /*
        var idx = self.players.indexOf(p);
        if (idx == -1) {
            return;
        }
        self.players.splice(idx, 1);
        self.players.forEach(function(p2) {
            p2.socket.emit('player_left', p);
        });
        if (self.players.length < 2) {
            self.players.forEach(self.send_game_over);
        }
        */
        
    };
    
    self.move = function(player, move_info) {
        
        var player_id = self.players.indexOf(player);
        if (player_id != self.whose_turn) {
            return; // Nope!
        }
        
        // TODO: move actions
        
        
        if (self.is_win_condition()) {
            return;
        }
        
        self.pass_turn();    
        
    };
    
    self.is_win_condition = function() {
       var winner = _(self.players).find(function(p) {
          
           return _(self.rules.win_conditions).any(function(c) {
               return p.resources[c.resource] >= c.amount;
           });
           
       });
       
       if (winner) {
           // go to win state
           
            self.players.forEach(function(p) {
                p.socket.emit('winner', self.players.indexOf(winner));
            });
       
            self.whose_turn = -1;
           
            return true;
       }
       
       return false;
    };
    
    self.pass_turn = function(turn) {
        if (turn !== undefined) {
            self.whose_turn = turn;
        } else {
                
            self.whose_turn++;
            self.whose_turn %= self.players.length;
            
        }
        self.players.forEach(function(p) {
            p.socket.emit("turn", self.whose_turn);
        });
        
    };
    
    
    players.forEach(function(p) {
        p.game = self;
        p.hand = [];
        p.play_area = [];
        p.game_id = players.indexOf;
        p.socket.emit("Game started", _(self.players).pluck("name"),
                      self.players.indexOf(p), self.rules);
    });
    
    
    // TODO: game state init
    
    
    // officially start the game (players can make actions)
    self.pass_turn(0);
    
    
    return self;
};

exports.Game = Game;
exports.load_rules = load_rules;