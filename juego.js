const canvas = document.getElementById("tablero");
const ctx = canvas.getContext("2d");

const tamaño_celda = 30;
const celdas = canvas.width / tamaño_celda;
const VELOCIDAD = 150; // milisegundos por tick

// lAS Imágenes están en una carpeta
const CARPETA = "Viborita/";

const archivos = {
    lactal: {
        cabeza: "cabeza-lactal.png",
        cuerpo: "cuerpo-lactal.jpg",
        cola: "cola-lactal.png"
    },
    salvado: {
        cabeza: "cabeza-salvado.png",
        cuerpo: "cuerpo-salvado.png",
        cola: "cola-salvado.png"
    }
};

let imagenes = {};
let jugadores = [];
let pan = null;
let resultado = null; // texto del resultado cuando termina la ronda
let victorias = [0, 0];
let intervaloJuego = null;

// ---------- Carga de imágenes ----------
function cargarImagen(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo cargar " + CARPETA + src));
        img.src = CARPETA + src;
    });
}

async function cargarTodas() {
    const salida = {};
    for (const [nombre, partes] of Object.entries(archivos)) {
        salida[nombre] = {};
        for (const [parte, src] of Object.entries(partes)) {
            salida[nombre][parte] = await cargarImagen(src);
        }
    }
    return salida;
}

// ---------- Jugadores ----------
function crearJugador(nombre, x, y, dx, imgs, color) {
    // cabeza en (x, y) y el cuerpo hacia atrás
    const cuerpo = [];
    for (let i = 0; i < 3; i++) {
        cuerpo.push({ x: x - dx * i, y: y });
    }
    return {
        nombre,
        cuerpo,
        dir: { x: dx, y: 0 },     // dirección aplicada en el último tick
        proxima: { x: dx, y: 0 }, // dirección pedida con el teclado
        imgs,
        color,
        panes: 0
    };
}

// Jugador 0 = flechas, jugador 1 = W A S D
const controles = {
    ArrowUp: [0, { x: 0, y: -1 }],
    ArrowDown: [0, { x: 0, y: 1 }],
    ArrowLeft: [0, { x: -1, y: 0 }],
    ArrowRight: [0, { x: 1, y: 0 }],
    w: [1, { x: 0, y: -1 }],
    s: [1, { x: 0, y: 1 }],
    a: [1, { x: -1, y: 0 }],
    d: [1, { x: 1, y: 0 }]
};

// ---------- Utilidades ----------
const igual = (a, b) => a.x === b.x && a.y === b.y;

function fueraDelTablero(c) {
    return c.x < 0 || c.x >= celdas || c.y < 0 || c.y >= celdas;
}

function nuevoPan() {
    let celda;
    do {
        celda = {
            x: Math.floor(Math.random() * celdas),
            y: Math.floor(Math.random() * celdas)
        };
    } while (jugadores.some(j => j.cuerpo.some(s => igual(s, celda))));
    return celda;
}

// Las imágenes están dibujadas "mirando hacia arriba".
// Esta función devuelve cuánto rotar para que miren hacia (dx, dy).
function angulo(dx, dy) {
    return Math.atan2(dx, -dy);
}

// ---------- Lógica ----------
function reiniciar() {
    clearInterval(intervaloJuego);
    jugadores = [
        crearJugador("Lactal", 5, 5, 1, imagenes.lactal, "#3b8ed0"),
        crearJugador("Salvado", celdas - 6, celdas - 6, -1, imagenes.salvado, "#2e8b57")
    ];
    pan = nuevoPan();
    resultado = null;
    redibujarCanvas();
    intervaloJuego = setInterval(actualizarJuego, VELOCIDAD);
}

function actualizarJuego() {
    // Aplicamos la dirección pedida por cada jugador
    jugadores.forEach(j => { j.dir = j.proxima; });

    // Nuevas cabezas
    const nuevas = jugadores.map(j => ({
        x: j.cuerpo[0].x + j.dir.x,
        y: j.cuerpo[0].y + j.dir.y
    }));

    // ¿Alguien come pan? (si come, no pierde la cola este tick)
    const crece = nuevas.map(c => igual(c, pan));
    const cuerpoSinCola = jugadores.map((j, i) =>
        crece[i] ? j.cuerpo : j.cuerpo.slice(0, -1)
    );

    // ¿Quién choca?
    const muerto = jugadores.map((j, i) => {
        const c = nuevas[i];
        const otro = 1 - i;
        return (
            fueraDelTablero(c) ||
            cuerpoSinCola[i].some(s => igual(s, c)) ||     // contra sí misma
            cuerpoSinCola[otro].some(s => igual(s, c)) ||  // contra la otra
            igual(c, nuevas[otro])                         // cabeza contra cabeza
        );
    });

    if (muerto[0] || muerto[1]) {
        terminarRonda(muerto);
        return;
    }

    // Mover
    jugadores.forEach((j, i) => {
        j.cuerpo.unshift(nuevas[i]);
        if (crece[i]) {
            j.panes++;
        } else {
            j.cuerpo.pop();
        }
    });

    if (crece.some(Boolean)) {
        pan = nuevoPan();
    }

    redibujarCanvas();
}

function terminarRonda(muerto) {
    clearInterval(intervaloJuego);
    if (muerto[0] && muerto[1]) {
        resultado = "¡Empate! Chocaron las dos";
    } else {
        const ganador = muerto[0] ? 1 : 0;
        victorias[ganador]++;
        resultado = "¡Ganó " + jugadores[ganador].nombre + "!";
    }
    redibujarCanvas();
}

// ---------- Dibujo ----------
function dibujarImagen(img, celda, rotacion) {
    ctx.save();
    ctx.translate(
        celda.x * tamaño_celda + tamaño_celda / 2,
        celda.y * tamaño_celda + tamaño_celda / 2
    );
    ctx.rotate(rotacion);
    ctx.drawImage(img, -tamaño_celda / 2, -tamaño_celda / 2, tamaño_celda, tamaño_celda);
    ctx.restore();
}

function dibujarSerpiente(j) {
    const c = j.cuerpo;
    const n = c.length;
    // De la cola a la cabeza, así la cabeza queda por encima
    for (let i = n - 1; i >= 0; i--) {
        if (i === 0) {
            dibujarImagen(j.imgs.cabeza, c[0], angulo(j.dir.x, j.dir.y));
        } else if (i === n - 1) {
            // la cola "apunta" hacia el segmento anterior
            const previo = c[i - 1];
            dibujarImagen(j.imgs.cola, c[i], angulo(previo.x - c[i].x, previo.y - c[i].y));
        } else {
            const horizontal = c[i - 1].y === c[i].y;
            dibujarImagen(j.imgs.cuerpo, c[i], horizontal ? Math.PI / 2 : 0);
        }
    }
}

// Rebanada de pan dibujada con el canvas (no hace falta imagen)
function dibujarPan(celda) {
    const s = tamaño_celda * 0.7;
    ctx.save();
    ctx.translate(
        celda.x * tamaño_celda + tamaño_celda / 2,
        celda.y * tamaño_celda + tamaño_celda / 2
    );

    const forma = new Path2D();
    forma.moveTo(-s * 0.4, s * 0.45);
    forma.lineTo(-s * 0.4, -s * 0.05);
    forma.bezierCurveTo(-s * 0.65, -s * 0.1, -s * 0.55, -s * 0.55, -s * 0.2, -s * 0.5);
    forma.bezierCurveTo(-s * 0.1, -s * 0.62, s * 0.1, -s * 0.62, s * 0.2, -s * 0.5);
    forma.bezierCurveTo(s * 0.55, -s * 0.55, s * 0.65, -s * 0.1, s * 0.4, -s * 0.05);
    forma.lineTo(s * 0.4, s * 0.45);
    forma.closePath();

    // corteza
    ctx.fillStyle = "#b8772e";
    ctx.fill(forma);
    // miga
    ctx.scale(0.8, 0.8);
    ctx.fillStyle = "#f8e3b0";
    ctx.fill(forma);
    ctx.restore();
}

function dibujarMarcador() {
    ctx.font = "bold 14px sans-serif";
    ctx.textBaseline = "top";

    ctx.textAlign = "left";
    ctx.fillStyle = jugadores[0].color;
    ctx.fillText(
        jugadores[0].nombre + " 🍞 " + jugadores[0].panes + "  🏆 " + victorias[0],
        8, 6
    );

    ctx.textAlign = "right";
    ctx.fillStyle = jugadores[1].color;
    ctx.fillText(
        jugadores[1].nombre + " 🍞 " + jugadores[1].panes + "  🏆 " + victorias[1],
        canvas.width - 8, 6
    );
}

function dibujarResultado() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText(resultado, canvas.width / 2, canvas.height / 2 - 15);
    ctx.font = "18px sans-serif";
    ctx.fillText("Presioná Enter para jugar de nuevo", canvas.width / 2, canvas.height / 2 + 25);
}

function redibujarCanvas() {
    // Fondo color trigo
    ctx.fillStyle = "#f5deb3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    dibujarMarcador();
    dibujarPan(pan);
    jugadores.forEach(dibujarSerpiente);

    if (resultado) {
        dibujarResultado();
    }
}

// ---------- Teclado ----------
document.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && resultado) {
        reiniciar();
        return;
    }

    const tecla = evento.key.length === 1 ? evento.key.toLowerCase() : evento.key;
    const control = controles[tecla];
    if (!control) return;

    evento.preventDefault(); // evita que las flechas muevan la página

    const jugador = jugadores[control[0]];
    if (!jugador || resultado) return;

    const nueva = control[1];
    // No se puede dar la vuelta en U sobre sí misma
    if (nueva.x === -jugador.dir.x && nueva.y === -jugador.dir.y) return;

    jugador.proxima = nueva;
});

// ---------- Inicio ----------
cargarTodas()
    .then(imgs => {
        imagenes = imgs;
        reiniciar();
    })
    .catch(error => {
        console.error(error);
        alert(error.message + "\nRevisá los nombres de los archivos y la carpeta (CARPETA).");
    });