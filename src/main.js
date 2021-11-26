const front = {
  unstaged_p1: table2array(
    document.querySelector('#unstaged_p1').firstElementChild,
  ),
  unstaged_p2: table2array(
    document.querySelector('#unstaged_p2').firstElementChild,
  ),
  stage: table2array(document.querySelector('#stage').firstElementChild),
  board: table2array(document.querySelector('#board').firstElementChild),
  state: document.querySelector('#state'),
  message: document.querySelector('.message'),
};
// show temporally message
function notice(str) {
  let p = document.createElement('p');
  p.textContent = str;
  p.id = 'p' + Math.floor(Math.random() * 65536);
  front.message.prepend(p);
  setTimeout(() => {
    document.querySelector('#' + p.id).remove();
  }, 3000);
}

// map a table to a 2d array
function table2array(tbl) {
  a = [];
  for (let i = 0; i < tbl.rows.length; i++) {
    a[i] = [];
    for (let j = 0; j < tbl.rows[i].cells.length; j++) {
      a[i][j] = tbl.rows[i].cells[j];
    }
  }
  return a;
}

const Piece = {
  Large: 4,
  Middle: 2,
  Small: 1,
  None: 0,
};
const Player = {
  p1: 0,
  p2: 1,
};
const State = {
  staging: 0,
  commit: 1,
};

class Cell {
  //         +----  Piece.Large
  //         |+---  Piece.Middle
  //         ||+--  Piece.Small
  //         |||
  //         vvv
  // _p1 = 0b000
  // _p2 = 0b000
  constructor([initp1 = Piece.None, initp2 = Piece.None]) {
    this._p1 = initp1;
    this._p2 = initp2;
    console.assert(
      (this._p1 & this._p2) == 0,
      'Placed piece at a cell must be exclusive',
    );
  }
  visiblePiece() {
    if (this._p1 == this._p2) return [null, Piece.None]; // they must be 0 when no piece is placed
    // otherwise there must be something
    // [which player places the (most outside) piece, what pieces are placed]
    const [player, pieces] =
      this._p1 > this._p2 ? [Player.p1, this._p1] : [Player.p2, this._p2];
    // prettier-ignore
    const visible =
      (pieces & Piece.Large)  ? Piece.Large  :
      (pieces & Piece.Middle) ? Piece.Middle :
                                Piece.Small;
    return [player, visible];
  }
  isPlaceable(toPlace) {
    // player can place a piece unless cell has the same or larger pieces.
    return this._p1 < toPlace && this._p2 < toPlace;
  }
  // pick player's visible piece. return picked one.
  pick(player) {
    const [player2pick, piece2pick] = this.visiblePiece();
    if (piece2pick == Piece.None) return null; // fail; none to pick.
    if (player2pick != player) return null; // fail; visible is not yours.
    //let where2pick = player == Player.p1 ? this._p1 : this._p2;
    //where2pick &= ~piece2pick;
    if (player == Player.p1) {
      this._p1 &= ~piece2pick;
    } else {
      this._p2 &= ~piece2pick;
    }
    return piece2pick;
  }
  place(player, piece) {
    console.assert(piece != Piece.None, 'No piece to place');
    if (!this.isPlaceable(piece)) return false; // do nothing if unplaceable
    //let where2place = player == Player.p1 ? this._p1 : this._p2;
    //where2place |= piece;
    if (player == Player.p1) {
      this._p1 |= piece;
    } else {
      this._p2 |= piece;
    }
    return true;
  }
}

class Board {
  constructor(
    sizey,
    sizex,
    initializer = (y, x) => {
      return [Piece.None, Piece.None];
    },
  ) {
    this._b = [];
    for (let y = 0; y < sizey; y++) {
      this._b[y] = [];
      for (let x = 0; x < sizex; x++) {
        this._b[y][x] = new Cell(initializer(y, x));
      }
    }
  }
  cell(y, x) {
    return this._b[y][x];
  }
  isPlaceableAnywhere(piece) {
    return this._b.some((row) => {
      return row.some((cell) => {
        return cell.isPlaceable(piece);
      });
    });
  }
}

const game = {
  unstaged_p1: new Board(3, 2, (y) => {
    return [
      y == 0 ? Piece.Large : y == 1 ? Piece.Middle : Piece.Small,
      Piece.None,
    ];
  }),
  unstaged_p2: new Board(3, 2, (y) => {
    return [
      Piece.None,
      y == 0 ? Piece.Large : y == 1 ? Piece.Middle : Piece.Small,
    ];
  }),
  stage: new Board(1, 1),
  board: new Board(3, 3),
  state: State.staging,
  turn: Player.p1,
  // Store where a piece is picked up. The piece can't place back to here in single turn.
  // Note that ones from unstaged piece can be placed anywhere
  lastPicked: [0, 0],
};

function updateFront() {
  const updateTable = (table, board) => {
    table.forEach((r, y) => {
      r.forEach((c, x) => {
        const p = c.firstElementChild; // get paragraph to update its attribute
        const [player, piece] = board.cell(y, x).visiblePiece();
        p.hidden = piece == Piece.None;
        // prettier-ignore
        p.className =
          piece == Piece.Large  ? 'pieceLarge '  :
          piece == Piece.Middle ? 'pieceMiddle ' :
          piece == Piece.Small  ? 'pieceSmall '  :
                                  'none ';
        p.className += player == Player.p1 ? 'player1' : 'player2';
        // prettier-ignore
        const valid =
          (game.state == State.staging && checkPickable(board, y, x) === null) ||
          (game.state == State.commit && checkPlaceable(board, y, x) === null);
        // if this cell is valid to click, blink it
        c.className = c.className.replace(' blink', '');
        // Schedule blinking.
        // There is interval between blink-off to blink-on so that animation phase gets reset. Maybe firefox-only behavior though
        if (valid) {
          setTimeout(() => {
            c.className += ' blink';
          }, 100);
        }
      });
    });
  };
  updateTable(front.unstaged_p1, game.unstaged_p1);
  updateTable(front.unstaged_p2, game.unstaged_p2);
  updateTable(front.stage, game.stage);
  updateTable(front.board, game.board);

  front.state.textContent =
    (game.state == State.staging ? 'Pick' : 'Place') +
    ' your piece, ' +
    (game.turn == Player.p1 ? 'Player1' : 'Player2');
}

// check if the piece attempt to pick is yours and placeable to the board
// return message if error
function checkPickable(board, y, x) {
  const [playerAttempt, pieceAttempt] = board.cell(y, x).visiblePiece();
  if (playerAttempt != game.turn) {
    return 'Visible piece here is not yours';
  }
  if (!game.board.isPlaceableAnywhere(pieceAttempt)) {
    // Checking if the piece is placeable to anywhere before picking.
    // If placeable, that means, there is a place the piece can place to other than the current place.
    return 'The piece you attempt to pick is not placeable to the board, so unable to pick';
  }
  return null; // no error
}
function checkPlaceable(board, y, x) {
  if (board != game.board) {
    return 'You can place the piece only to the center board';
  }
  if (
    game.lastPicked !== null &&
    y == game.lastPicked[0] &&
    x == game.lastPicked[1]
  ) {
    return 'You can not place the piece back to the cell where the piece came from';
  }
  if (
    !board.cell(y, x).isPlaceable(game.stage.cell(0, 0).visiblePiece()[1]) // [1] is a piece to place
  ) {
    // Player must select a cell which accepts the staging piece
    return 'This cell is occupied';
  }
  return null;
}

function init() {
  // initialize html table and board
  const connectTB = (table, board) => {
    table.forEach((r, y) => {
      r.forEach((c, x) => {
        // Place ◯ (drawn via css) as a piece.
        c.appendChild(document.createElement('p'));

        c.addEventListener('click', function () {
          //notice(y + ',' + x + ',' + player + ',' + piece);
          if (game.state == State.staging) {
            // check if pickable
            const error = checkPickable(board, y, x);
            if (error !== null) {
              notice(error);
              return;
            }
            const pick = board.cell(y, x).pick(game.turn);
            // Memory where the piece comes from
            if (board == game.board) {
              game.lastPicked = [y, x];
            } else {
              game.lastPicked = null;
            }
            // step next
            game.stage.cell(0, 0).place(game.turn, pick);
            game.state = State.commit;
          } else if (game.state == State.commit) {
            const error = checkPlaceable(board, y, x);
            if (error !== null) {
              notice(error);
              return;
            }
            const pick = game.stage.cell(0, 0).pick(game.turn);
            console.assert(
              pick !== null,
              'There should be my piece here at commit state',
            );
            board.cell(y, x).place(game.turn, pick);
            // step next
            game.state = State.staging;
            game.turn = game.turn == Player.p1 ? Player.p2 : Player.p1; // flip player
          } else {
            console.assert(false, 'unknown state');
          }
          updateFront();
        });
      });
    });
  };
  connectTB(front.unstaged_p1, game.unstaged_p1);
  connectTB(front.unstaged_p2, game.unstaged_p2);
  connectTB(front.stage, game.stage);
  connectTB(front.board, game.board);
  updateFront();
}
init();

// Store what/how many pieces are placed

class GameState {
  constructor() {
    this._p1 = new Player();
    this._p2 = new Player();
  }
}
