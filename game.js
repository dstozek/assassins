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
        rules: rules || DefaultRules,
        map: null,
        // list of people (including assasins)
        people: null,
        // list of guards
        guards: null,
        // king
        king: {health: 2, x: 0, y: 0}
        
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
    
    self.send_game_state = function(player, hideAssassins) {
        
        var state = {
            people: self.people,
            guards: self.guards,
            king: self.king
        }
        
        state = JSON.parse(JSON.stringify(state));
        
        if (hideAssassins) {
            for (var i=0; i < state.people.length; i++) {
                if (!state.people[i].uncovered) {
                    state.people[i].assassin = false;
                }
            }
        }
        
        player.socket.emit("game state", state);
    }
    
    
    players.forEach(function(p) {
        p.game = self;
        p.hand = [];
        p.play_area = [];
        p.game_id = players.indexOf;
        p.socket.emit("Game started", _(self.players).pluck("name"),
                      self.players.indexOf(p), self.rules);
    });
    
    
    // game state init
    
    self.people = [];
    for (var i=0; i < self.rules.people_positions.length; i++) {
        self.people.push({x: self.rules.people_positions[i][0], y: self.rules.people_positions[i][1], assassin: false, uncovered: false});
    }
    
    //  choose 3 assasins
    _(_(self.people).sample(self.rules.assassin_count)).each(function(p) {
        p.assassin = true;
    });
    
    self.guards = [];
    for (var i=0; i < self.rules.guard_positions.length; i++) {
        self.guards.push({x: self.rules.guard_positions[i][0], y: self.rules.guard_positions[i][1], assassin: false, uncovered: false});
    }
    
    
    self.king.x = self.rules.king_position[0];
    self.king.y = self.rules.king_position[1];
    
    self.send_game_state(players[0], true);
    self.send_game_state(players[1], false);
    
    
    
    
    // officially start the game (players can make actions)
    self.pass_turn(0);
    
    
    
    return self;
};

exports.Game = Game;
exports.load_rules = load_rules;