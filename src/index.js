const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

app.use(express.json());

const port = process.env.PORT || 3000;

const publicDirectoryPath = path.join(__dirname, '../public');
app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {
    console.log('New WebSocket connection :o!');

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({
            id: socket.id,
            ...options
        });

        if (error) {
            return callback(error);
        }

        socket.join( // allows to join a given room
            user.room
        );

        socket.emit('message', generateMessage('Admin', 'Welcome! ;)'));

        socket.broadcast.to(user.room).emit(  // sends event to every connection in the room except itself
            'message',
            generateMessage('Admin', `${user.username} has joined! :D`)
        );

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        });

        callback();
    });

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id);

        if (!user) {
            callback('No user found...');
        }

        const filter = new Filter();
        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed');
        }

        io.to(user.room).emit(
            'message',
            generateMessage(user.username, message)
        );

        callback();
    });

    socket.on('sendLocation', ({ lat, long }, callback) => {
        const user = getUser(socket.id);
        
        if (!user) {
            callback('No user found...');
        }

        io.to(user.room).emit(
            'locationMessage',
            generateLocationMessage(user.username,{ lat, long })
        );
        callback();
    });

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);

        if (user) {
            io.to(user.room).emit(
                'message'
                , generateMessage('Admin', `${user.username} has left :(`));

            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            });
        }
    });
});

server.listen(port, () => {
    console.log(`Server is up on port ${port}`);
});