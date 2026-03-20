let slideIndex = 0;

// SLIDES
function mostrarSlides(){

    let slides = document.getElementsByClassName("slide");

    for(let i = 0; i < slides.length; i++){
        slides[i].style.display = "none";
    }

    slideIndex++;

    if(slideIndex > slides.length){
        slideIndex = 1;
    }

    slides[slideIndex-1].style.display = "block";

    setTimeout(mostrarSlides, 3000);
}

// INICIA SLIDES
mostrarSlides();


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