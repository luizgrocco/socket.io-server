import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { customAlphabet } from "nanoid";
const ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 10;

// Create a NanoID generator using the custom alphabet
const generateID = customAlphabet(ID_ALPHABET, ID_LENGTH);
// import { fileURLToPath } from "node:url";
// import { dirname, join } from "node:path";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
});

// const __dirname = dirname(fileURLToPath(import.meta.url));

const rooms = {};
const users = {};

app.get("/", (req, res) => {
  res.send("<h1>Hello World!</h1>");
});

io.on("connection", (socket) => {
  console.log(`${socket.id} connected`);

  socket.on("create_room", ({ username, cubeState = [], queueState = [] }) => {
    console.log("create_room received", username);
    // TODO: Validate all required fields to create a room
    if (!username) {
      socket.emit("create_room_error", { message: "Invalid username" });
      return;
    }

    const roomId = generateID();

    if (rooms[roomId]) {
      socket.emit("create_room_error", { message: "Room already exists" });
      return;
    }

    const owner = { username, socketId: socket.id };

    rooms[roomId] = {
      owner,
      users: [owner],
      cubeState,
      queueState,
    };
    users[socket.id] = { username, roomId };
    socket.join(roomId);
    io.to(roomId).emit("join_room_success", { roomId, cubeState, queueState });
  });

  socket.on("join_room", ({ roomId, username }) => {
    console.log("join_room received");
    if (!roomId || !rooms[roomId]) {
      socket.emit("join_room_error", { message: "Room does not exist" });
      return;
    }

    if (!username) {
      socket.emit("join_room_error", {
        message: "Invalid username",
      });
      return;
    }

    if (rooms[roomId].users.length >= 4) {
      socket.emit("join_room_error", { message: "room is full" });
    }

    if (rooms[roomId].users.find(({ username: user }) => user === username)) {
      socket.emit("join_room_error", {
        message: "Username taken",
      });
      return;
    }

    rooms[roomId].users.push({ username, socketId: socket.id });
    users[socket.id] = { username, roomId };
    socket.join(roomId);
    io.to(roomId).emit("join_room_success", { roomId, cubeState, queueState });
  });

  // Require roomId, can infer from users table, but shouldn't
  socket.on("enqueue_move", ({ roomId, move }) => {});

  // Since no data is passed on disconnect, only way is to infer roomId
  socket.on("disconnect", () => {
    console.log(`${socket.id} disconnected`);
    const disconnectedRoomId = users?.[socket.id]?.roomId;
    if (disconnectedRoomId) {
      delete users[socket.id];
      rooms[disconnectedRoomId].users.filter(
        (user) => user.socketId !== socket.id
      );
    }
  });
});

io.engine.on("connection_error", (err) => {
  console.log(err.req); // the request object
  console.log(err.code); // the error code, for example 1
  console.log(err.message); // the error message, for example "Session ID unknown"
  console.log(err.context); // some additional error context
});

server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});
