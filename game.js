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
        king: {health: 2, x: 0, y: 0},
        can_arrest: false,
        guard_actions: 0,
        king_actions: 0,
        people_actions: 0,
        killed_guard_this_turn: false
        
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
    
    self.unit_find = function(row, col) {
         
        return _.find(_.union(self.guards, self.people, [self.king]), function(f) {
            return f.x == col && f.y == row;
        });
    }
    
    self.unit_kill = function(unit) {
        if (unit.type == 'p') {
            self.people = _(self.people).without(unit);
        }   
        if (unit.type == 'g') {
            self.guards = _(self.guards).without(unit);
        }
        if (unit.type == 'k') {
            self.king.health--;
        }
    }
    
    self.unit_owner = function(unit) {
        if (unit.type == 'p') return 1;
        return 0;
    }
    
    self.unit_action_cost = function(unit, action) {
        var unit_type = 'people';
        if (unit.type == 'g') unit_type = 'guard';
        if (unit.type == 'k') unit_type = 'king';
        
        var unit_type2 = unit_type;
        if (unit.uncovered) {
            unit_type2 = 'assassin';
        }
        
        var cost = self.rules.action_costs[unit_type2][action];
        if(cost > self[unit_type+'_actions']) return false;
        
        
        self[unit_type+'_actions'] -= cost;
        
        return true;
    }
    
    self.move = function(player, m) {
        
        var player_id = self.players.indexOf(player);
        if (player_id != self.whose_turn) {
            return; // Nope!
        }
        
        if (m.pass) {
            self.pass_turn();
            return;
        }
        
        var unit = self.unit_find(m.old_row, m.old_col);
        
        if (!unit || self.unit_owner(unit) != player_id) {
            return;
        }
        
        if (m.uncover) {
            unit.uncovered = true;
            self.send_game_state(players[0], true);
            self.send_game_state(players[1], false);
            return;
        }
        
        // allow only actions adjacent to the unit
        if (Math.abs(m.old_row - m.row) + Math.abs(m.old_col - m.col) > 1) return;
        
        var attackedUnit = self.unit_find(m.row, m.col);
        var isAttack = attackedUnit && attackedUnit && self.unit_owner(unit) != self.unit_owner(attackedUnit)
        
        var isClimb = self.rules.map[m.old_row][m.old_col] != 1 && self.rules.map[m.row][m.col] == 1;
        var isDrop = self.rules.map[m.old_row][m.old_col] == 1 && self.rules.map[m.row][m.col] != 1;
        
        
        if (isAttack) {
            console.log('in the way', attackedUnit);
            
            if (isClimb) return;
            
            if (unit.type == 'g' && attackedUnit.type == 'p') {
                if (attackedUnit.assassin && attackedUnit.uncovered) {
                    // kill assasin
                    
                    if (!self.unit_action_cost(unit, 'kill')) return;
                    self.unit_kill(attackedUnit);
                    
                } else {
                    // kill person
                    if (!self.can_arrest) return;
                    if (!self.unit_action_cost(unit, 'kill_person')) return;
                    self.unit_kill(attackedUnit);
                }
            } else if (unit.type == 'p' && unit.assassin && unit.uncovered && attackedUnit.type == 'g') {
                // kill guard
                if (self.killed_guard_this_turn)
                {
                    if (!self.unit_action_cost(unit, 'kill_next')) return;
                } else {
                    if (!self.unit_action_cost(unit, 'kill')) return;
                }
                self.killed_guard_this_turn = true;
                self.unit_kill(attackedUnit);
            } else if (unit.type == 'p' && unit.assassin && unit.uncovered && attackedUnit.type == 'k') {
                // attack the king
                if (!self.unit_action_cost(unit, 'kill_king')) return;
                self.unit_kill(attackedUnit);
                
            } else return;
            
                
            self.send_game_state(players[0], true);
            self.send_game_state(players[1], false);
            
            if (self.is_win_condition()) {
                return;
            }
        
            
            return;
            
        }
        var action = 'move';
        if (isClimb) {
            action = 'climb';
        } else if (isDrop) {
            action = 'drop';
        }
    
        if (!self.unit_action_cost(unit, action)) return;
        
        unit.x = m.col;
        unit.y = m.row;
        
        self.send_game_state(players[0], true);
        self.send_game_state(players[1], false);
    
        console.log('sent gamestate');
        
        if (self.is_win_condition()) {
            return;
        }
        
        if (player_id == 0 && ((self.guard_actions + self.king_actions) === 0))
        {
            self.pass_turn();
        } else if (self.people_actions == 0) {
            self.pass_turn();
        }
        
    };
    
    self.is_win_condition = function() {
       
       var winner = null;
       if (self.king.health <= 0) {
           winner = 1;
       }
       if (!_(self.people).any(function(p) { return p.assassin;})) {
           // no assassins left
           winner = 0;
       }
       
       
       if (winner !== null) {
           // go to win state
           
            self.players.forEach(function(p) {
                p.socket.emit('winner', winner);
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
        // if round ends, reset counters
        if (self.whose_turn === 0) {
            self.guard_actions = Math.ceil(Math.random()*5);
            self.king_actions = Math.ceil(Math.random()*3);
            self.people_actions = Math.ceil(Math.random()*10);
            self.can_arrest = Math.random() > 0.7;
            self.killed_guard_this_turn = false;        
            self.send_game_state(players[0], true);
            self.send_game_state(players[1], false);
        }
        
        self.players.forEach(function(p) {
            p.socket.emit("turn", self.whose_turn);
        });
        
    };
    
    self.send_game_state = function(player, hideAssassins) {
        
        var state = {
            people: self.people,
            guards: self.guards,
            king: self.king,
            guard_actions: self.guard_actions,
            king_actions: self.king_actions,
            people_actions: self.people_actions,
            can_arrest: self.can_arrest
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
        self.people.push({x: self.rules.people_positions[i][0], y: self.rules.people_positions[i][1], assassin: false, uncovered: false, type: 'p', index: i});
    }
    
    //  choose 3 assasins
    _(_(self.people).sample(self.rules.assassin_count)).each(function(p) {
        p.assassin = true;
    });
    
    self.guards = [];
    for (var i=0; i < self.rules.guard_positions.length; i++) {
        self.guards.push({x: self.rules.guard_positions[i][0], y: self.rules.guard_positions[i][1], type: 'g', index: i});
    }
    
    
    self.king.x = self.rules.king_position[0];
    self.king.y = self.rules.king_position[1];
    self.king.type = 'k';
    self.king.index = 0;
    
    self.send_game_state(players[0], true);
    self.send_game_state(players[1], false);
    
    
    
    
    // officially start the game (players can make actions)
    self.pass_turn(0);
    
    
    
    return self;
};

exports.Game = Game;
exports.load_rules = load_rules;