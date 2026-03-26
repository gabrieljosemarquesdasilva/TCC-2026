let slideIndex = 0;

// ── SLIDER ──
let count = 1;
const totalSlides = 4;

// Inicia no primeiro slide
document.getElementById("radio1").checked = true;

// Avança automaticamente a cada 3 segundos
setInterval(function () {
    count++;
    if (count > totalSlides) count = 1;
    document.getElementById("radio" + count).checked = true;
}, 3000);


// IR DIRETO PRO AGENDAMENTO
function irParaAgendamento(quadra, horario){
    localStorage.setItem("quadra", quadra);
    localStorage.setItem("horario", horario);

    window.location.href = "agendamento.html";
}


// SELECIONAR HORÁRIO
function selecionarHorario(elemento, quadra){

    let horarios = document.querySelectorAll(".horarios span");
    horarios.forEach(h => h.classList.remove("selecionado"));

    elemento.classList.add("selecionado");

    let horario = elemento.textContent.trim();

    localStorage.setItem("horario", horario);
    localStorage.setItem("quadra", quadra);

    window.location.href = "agendamento.html";
}


// QUANDO A PÁGINA CARREGAR
document.addEventListener("DOMContentLoaded", function(){

    let horarioSalvo = localStorage.getItem("horario");
    let quadraSalva = localStorage.getItem("quadra");

    if(horarioSalvo){
        let input = document.getElementById("horario");
        if(input){
            input.value = horarioSalvo.slice(0,5);
        }
    }

    if(quadraSalva){
        let select = document.getElementById("quadra");
        if(select){
            select.value = quadraSalva;
        }
    }

});

function abrirImagem(src){
    let modal = document.getElementById("modal-img");
    let img = document.getElementById("img-grande");

    modal.style.display = "flex";
    img.src = src;
}

function fecharImagem(){
    document.getElementById("modal-img").style.display = "none";
}

const numeros = document.querySelectorAll(".stat h2");

numeros.forEach(n => {
    let final = parseInt(n.innerText.replace("+",""));
    let atual = 0;

    let intervalo = setInterval(() => {
        atual += Math.ceil(final / 50);
        if(atual >= final){
            atual = final;
            clearInterval(intervalo);
        }
        n.innerText = "+" + atual;
    }, 30);
});

