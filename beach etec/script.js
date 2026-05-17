let slideIndex = 0;

// ── SLIDER ──
let count = 1;
const totalSlides = 4;

// só executa se existir slider
const radio = document.getElementById("radio1");
if (radio) {
    radio.checked = true;

    setInterval(function () {
        count++;
        if (count > totalSlides) count = 1;

        const atual = document.getElementById("radio" + count);
        if (atual) {
            atual.checked = true;
        }
    }, 3000);
}


// ── IR PRO AGENDAMENTO ──
function irParaAgendamento(quadra, horario){
    localStorage.setItem("quadra", quadra);
    localStorage.setItem("horario", horario);
    window.location.href = "agendamento.html";
}


// ── SELECIONAR HORÁRIO ──
function selecionarHorario(elemento, quadra){

    let horarios = document.querySelectorAll(".horarios span");
    horarios.forEach(h => h.classList.remove("selecionado"));

    elemento.classList.add("selecionado");

    let horario = elemento.textContent.trim();

    localStorage.setItem("horario", horario);
    localStorage.setItem("quadra", quadra);

    window.location.href = "agendamento.html";
}


// ── FUNÇÕES GERAIS AO CARREGAR ──
document.addEventListener("DOMContentLoaded", function(){

    // preencher dados do localStorage
    let horarioSalvo = localStorage.getItem("horario");
    let quadraSalva = localStorage.getItem("quadra");

    let inputHorario = document.getElementById("horario");
    if (horarioSalvo && inputHorario) {
        inputHorario.value = horarioSalvo.slice(0,5);
    }

    let selectQuadra = document.getElementById("quadra");
    if (quadraSalva && selectQuadra) {
        selectQuadra.value = quadraSalva;
    }


    // ── ANIMAÇÃO DOS NÚMEROS ──
    const numeros = document.querySelectorAll(".stat h2");

    if (numeros.length > 0) {
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
    }


    // ── ENVIO DO FORMULÁRIO ──
    const form = document.getElementById("form-agendamento");

    if(form){
        form.addEventListener("submit", function(e){
            e.preventDefault();

            const dados = {
                nome: document.querySelector('input[name="nome"]').value,
                quadra: document.querySelector('select[name="quadra"]').value,
                data: document.querySelector('input[name="data"]').value,
                horario: document.querySelector('input[name="horario"]').value,
                modalidade: document.querySelector('select[name="modalidade"]').value,
                nivel: document.querySelector('select[name="nivel"]').value
            };

            fetch("http://localhost:3000/agendar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(dados)
            })
            .then(res => res.text())
            .then(msg => {

    // pegar dados do formulário
    const quadra = document.querySelector('select[name="quadra"]').value;
    const modalidade = document.querySelector('select[name="modalidade"]').value;
    const data = document.querySelector('input[name="data"]').value;
    const horario = document.querySelector('input[name="horario"]').value;

    // inserir informações no modal
    document.getElementById("infoQuadra").innerText = "📍 " + quadra;
    document.getElementById("infoModalidade").innerText = modalidade;
    document.getElementById("infoData").innerText = "📅 " + data;
    document.getElementById("infoHorario").innerText = "⏰ " + horario;

    // abrir modal
    abrirModal();

    form.reset();
})
            .catch(err => {
                console.error(err);
                alert("Erro ao conectar com o servidor");
            });
        });
    }


    // ── LISTAR AGENDAMENTOS (PERFIL) ──
    const lista = document.getElementById("lista-agendamentos");

    if(lista){
        fetch("http://localhost:3000/agendamentos")
        .then(res => res.json())
        .then(dados => {

            if(dados.length === 0){
                lista.innerHTML = "<p>Nenhum agendamento encontrado.</p>";
                return;
            }

            dados.forEach(ag => {

                let item = document.createElement("div");
                item.classList.add("card-agendamento");

                item.innerHTML = `
                    <p><strong>Nome:</strong> ${ag.nome}</p>
                    <p><strong>Quadra:</strong> ${ag.quadra}</p>
                    <p><strong>Data:</strong> ${ag.data}</p>
                    <p><strong>Horário:</strong> ${ag.horario}</p>
                    <p><strong>Modalidade:</strong> ${ag.modalidade}</p>
                    <p><strong>Nível:</strong> ${ag.nivel}</p>
                    <hr>
                `;

                lista.appendChild(item);
            });

        })
        .catch(err => {
            console.error(err);
            lista.innerHTML = "<p>Erro ao carregar agendamentos</p>";
        });
    }

});


// ── MODAL DE IMAGEM ──
function abrirImagem(src){
    let modal = document.getElementById("modal-img");
    let img = document.getElementById("img-grande");

    if(modal && img){
        modal.style.display = "flex";
        img.src = src;
    }
}

function fecharImagem(){
    let modal = document.getElementById("modal-img");
    if(modal){
        modal.style.display = "none";
    }
}

function abrirModal(){
    let modal = document.getElementById("modalSucesso");

    if(modal){
        modal.style.display = "flex";
    }
}

function fecharModal(){
    let modal = document.getElementById("modalSucesso");

    if(modal){
        modal.style.display = "none";
    }
}

// ── CARREGAR DADOS DO USUÁRIO NO PERFIL ──
const usuario = JSON.parse(localStorage.getItem("usuario"));

if(usuario){

    const nome = document.getElementById("nome-perfil");
    const email = document.getElementById("email-perfil");
    const telefone = document.getElementById("telefone-perfil");
    const nascimento = document.getElementById("nascimento-perfil");

    if(nome){
        nome.innerText = usuario.nome + " " + usuario.sobrenome;
    }

    if(email){
        email.innerText = usuario.email;
    }

    if(telefone){
        telefone.innerText = usuario.telefone;
    }

    if(nascimento){
        // formata data bonitinha
        const data = new Date(usuario.nascimento);
        nascimento.innerText = data.toLocaleDateString("pt-BR");
    }
}
