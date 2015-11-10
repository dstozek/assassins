/* global io, _ */
var socket = io.connect('/');

socket.on('lobby list', function(names) {
    $('#players').html('');
    names.forEach(function(n) {
        $('<li>').text(n).appendTo($('#players')).addClass("list-group-item"); 
    });
    if (names.length >= 2 && MY_NICK){
        console.log("Start enabled")
        $("#lobby-start").show();
    }
});

var PLAYER_DIVS = [];
var PLAYER_NAMES = [];
var MY_IDX = null;
var MY_NICK = null;

var rules = null;

socket.on('Game started', function(player_names, my_idx, r) {
    $('#lobby').hide();
    $('#game').show();
    
    rules = r;
    
    $('#btn-pass').click(function() {
        socket.emit('move', null);
    });
    MY_IDX = my_idx;
    PLAYER_NAMES = player_names;
    
    var res_init = function(container) {
            
    };
    
    player_names.forEach(function (p, i) {
        
            var d = $('<div>').appendTo($('#players-game'))
                .addClass("list-group-item");
                
         
        var text = p;
        
        if (i == my_idx) {    
            text += ' (Me)';
        }
        
        if (i == 0) {
            text += ' - King & The Guard';
        } else {
            text += ' - The Assassins & The People';
        }
        
        $('<h4>').text(text).appendTo(d);

    });
    
    
    var boardElement = $('<table class="board">');
    // create html table as a board
    for (var row=0; row < rules.map.length; row++) {
        var rowElement = $('<tr>');
        boardElement.append(rowElement);
        for (var col=0; col < rules.map[row].length; col++) {  
            
            
            
            var cls = "street";
            if (rules.map[row][col] === 1) {
                cls = "rooftop";
            }
            if (rules.map[row][col] === 2) {
                cls = "finish";
            }
            
            rowElement.append('<td class="'+cls+'" id="board-'+row+'-'+col+'">&nbsp;</td>');
        }
    }
    
    $('<div id="play-area-'+ my_idx +'">').appendTo('#my-play');
    $('#my-play').append(boardElement);
    
    res_init($("#my-resources"));
    //$('#my-resources').find("[data-resource=food]")
    //PLAYER_DIVS[n].find("[data-resource=food]")
});

socket.on('Game over', function() {
    $('#game').hide();
    $('#gameover').show();
});

socket.on('game state', function(state) {
    console.log("Game state received!", state);
    
    // clear board
    for (var row=0; row < rules.map.length; row++) {
        for (var col=0; col < rules.map[row].length; col++) {  
            $('#board-'+row+'-'+col).html('&nbsp;');
        }
    }
    
    _(state.guards).each(function(g) {
        $('#board-'+g.y+'-'+g.x).html("G");
    });
    
    _(state.people).each(function(p) {
        var e = $('#board-'+p.y+'-'+p.x);
        
        var c = "P";
        if (p.assassin) {
            if (p.uncovered) {
                c = "A";
            } else {
                c = "P(A)";
            }
        }
        e.html(c);
    });
    
    $('#board-'+state.king.y+'-'+state.king.x).html("K");
    
});


socket.on('winner', function(winner_id) {
    console.log('winner');
    $('#game').hide();
    var winmsg = (winner_id === MY_IDX)?
                    "Congratulations, you won!":
                    "You lost. Better luck next time!";
    
    $('#game-over-message').text(winmsg);
    $('#gameover').show();
});

var make_card = function(card) {
    var card_elem = $('<div>').addClass("card");
    var card_miniature = $('<div>').addClass('card-front').appendTo(card_elem);
    var card_full = $('<div>').addClass("card-back").appendTo(card_elem).hide();
    var d = card_full;
    //d.text(JSON.stringify(card));
    
    $('<img src="'+card.definition.image+'" width="160" height="100">').appendTo(card_miniature);
    $('<h4>').css('text-align', 'center').text(card.definition.title).appendTo(card_miniature);
    
    $('<em>').text(card.definition.type).wrap('<p>').appendTo(d);
    $('<img width="235" height="145">').attr('src', card.definition.image).appendTo(d);
    $('<h3>').text(card.definition.title).appendTo(d);
    $('<p>').text(card.definition.description).appendTo(d);
    var reqs = $('<ul>').appendTo(d);
    card.definition.conditions.forEach(function(c) {
        $('<li>').text("Requires " + c.amount +" "+c.resource).appendTo(reqs);
    });
    var mods = $('<ul>').appendTo(d);
    card.definition.modifiers.forEach(function(c) {
        var f = c.change < 0?"Costs ":"Gives ";
        $('<li>').text(f + c.change +" "+c.resource).appendTo(mods);
    });
    $('<p><em>'+card.definition.flavour_text||""+'</em></p>').appendTo(d);
    
    card_elem.click(function() {
        console.log("playing card", card);
        socket.emit('play card', card.id);
    });
    card_elem.attr('data-card-id', card.id);
    card_elem.hide().delay(800).show('fast');

    var a = 'fast';
    card_miniature.mouseenter(function() {card_full.fadeIn(a)});
    card_elem.mouseleave(function() {card_full.fadeOut(a)});
    
    return card_elem;
}

socket.on('hand add', function(card) {
    var c = make_card(card);
    c.appendTo($('#my-hand'));
});

socket.on('table add', function(card) {
    console.log("table add", card);
    var c = make_card(card);
    c.appendTo($('#table'));
});

socket.on('play area add', function(card, player_id) {
    var c = make_card(card);
    c.appendTo($('#play-area-'+player_id));
});

socket.on('hand remove', function(card_id) {
    console.log("hand remove", card_id);
    $('[data-card-id='+card_id+']').hide('fast');
});

socket.on('hand add hidden', function(id, player_id) {
    if (PLAYER_DIVS[player_id]) {
        var d = $('<div>').html('&nbsp;')
            .appendTo(PLAYER_DIVS[player_id].hand)
            .addClass("hidden-card")
            .attr("data-card-id", id);
            
         d.hide().delay(800).show('fast');
    }
});

socket.on('activate card', function(card_id) {
    var e = $('[data-card-id='+card_id+']').find('.card-front');
    e.css('transform', 'rotate(90deg)');
    setTimeout(function() {
        e.css('transform', 'rotate(0deg)');
    }, 1200);
});

socket.on('turn', function(player_id) {
    console.log("It's player "+player_id+"'s turn now.");
    if (player_id == MY_IDX) {
        $("#my-turn-indicator").fadeIn('fast');
        $("#other-turn-indicator").fadeOut('fast');
    } else {
        $("#my-turn-indicator").fadeOut('fast');
        $("#other-turn-indicator").fadeIn('fast').text('Turn: ' + PLAYER_NAMES[player_id]);
    }
});

socket.on('update resources', function(player_id, resources) {
    console.log('update resources', player_id, resources);
    var part;
    if (player_id == MY_IDX) {
        part = $('#my-resources');
    } else {
        part = PLAYER_DIVS[player_id];
    }
    _(resources).pairs().forEach(function(pair) {
        var res_name = pair[0], value = pair[1];
        part.find("[data-resource="+res_name+"]").text(value);
    });
});

$('#nick_accept').click(function() {
    var n = $('#nick').val();
    if (!n) return;
    MY_NICK = n;
    console.log("emit", n);
    socket.emit('name', n);
    $("#lobby-login").hide();
});
$('#start_game').click(function() {
    socket.emit('start_game');
});
