var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

exports.listen = function (server) {
    io = socketio.listen(server);
    io.set('log.level', 1);
    io.sockets.on('connection', function (socket) {
        guestNumber = assignGuestName(socket, guestNumber,
            nickNames, namesUsed);
        joinRoom(socket, 'Lobby');
        handleMessageBroadcasting(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, namesUsed);
        handleRoomJoining(socket);
        socket.on('rooms', function () {
            socket.emit('rooms', io.sockets.adapter.rooms);
        });
        handleClientDisconnection(socket, nickNames, namesUsed);
    });
}

function assignGuestName(socket, guestNumber, nickNames, nameUsed) {
    var name = 'Guest' + guestNumber;
    nickNames[socket.id] = name;
    socket.emit('nameResult', {
        success: true,
        name: name
    });
    namesUsed.push(name);
    return guestNumber + 1;
}

function joinRoom(socket, room) {
    socket.join(room);
    currentRoom[socket.id] = room;
    socket.emit('jointResult', {room: room})
    socket.broadcast.to(room).emit('message', {
        text: nickNames[socket.id] + 'has joined '
    });
    // var usersInRoom = io.sockets.clients(room); // this function is deprecated
    var usersInRoom=io.sockets.adapter.rooms[room].length;
    // io.of('/').in(room).clients(function(error,clients){
    //     usersInRoom=clients.length;
    // });
    if (usersInRoom.length > 1) {
        var usersInRoomSummary = 'User currently in ' + room + ':';
        for (var index in usersInRoom) {
            var userSocektId = usersInRoom[index].id;
            if (userSocektId != socket.id) {
                if (index > 0)
                    usersInRoomSummary += ', ';
                usersInRoomSummary += nickNames[userSocektId];
            }
        }
        usersInRoomSummary += '.'
        socket.emit('message', {text: usersInRoomSummary});
    }
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on('nameAttempt', function (name) {
        if (name.indexOf('Guest') == 0)
            socket.emit('nameResult', {
                success: false,
                message: 'Names cannot begin with "Guest".'
            });
        else {
            if (namesUsed.indexOf(name) == -1) {
                var previousName = nickNames[socket.id];
                var previousNameIndex = namesUsed.indexOf(previousName);
                namesUsed.push(name);
                nickNames[socket.id] = name;
                delete namesUsed[previousNameIndex];
                socket.emit('nameResult', {
                    success: true,
                    name: name
                });
                socket.broadcast.to(currentRoom[socket.id]).emit('message', {
                    text: previousNameIndex + 'is now known as ' + name + '.'
                });
            } else {
                socket.emit('nameResult', {
                    success: true,
                    message: 'That name is already in use.'
                })
            }
        }
    })
}

function handleMessageBroadcasting(socket) {
    socket.on('message', function (message) {
        console.log(nickNames[socket.id],"send message:",message.text);
        socket.broadcast.to(message.room).emit('message', {
            text: nickNames[socket.id] + ':' + message.text
        });
    });
}

function handleRoomJoining(socket) {
    socket.on('join', function (room) {
        socket.leave(currentRoom[socket.id]);
        joinRoom(socket, room.newRoom);
    });
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function () {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}

// module.exports =this;