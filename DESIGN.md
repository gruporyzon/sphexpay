---
version: 2
name: SphexPay
description: Sistema visual da SphexPay — preto, branco e azul; premium, tecnológico e minimalista. Superfície pública (landing e fluxo de entrada) escura com acento azul; painel (/app) monocromático com modo claro e escuro completos. Os tokens vêm do CSS (fonte da verdade); este arquivo documenta, não substitui.

public:
  source: src/gateway-landing.css, src/features/signup/signupFlow.css
  font: "SphexGraphik, Arial, sans-serif"
  colors:
    bg: "#090909"
    surface: "#111111"
    surface-hover: "#161616"
    line: "#262626"
    line-strong: "#3d3d3d"
    text: "#f4f4f4"
    muted: "#a0a0a0"
    blue: "#0080ff"
    blue-hover: "#168bff"
    blue-line: "#60acff"
    focus: "#8cc5ff"
  aura: "radial #38b8ff → #135fff → #1246ed, faixa #132268 → #1d51ff → #53ddff (desfocada, animada)"
  button-primary: "fundo #0080ff, borda #60acff, raio 7px, sombra interna clara no topo e azul escura na base"
  button-outline: "fundo #090909, borda #3d3d3d, sombra interna clara de 1px"

workspace:
  source: src/workspace.css, src/workspace-modules.css
  font: "SphexDashboard (Raleway variável), Arial, sans-serif"
  light: { bg: "#ffffff", panel: "#ffffff", panel-2: "#f2f2f2", line: "#e2e2e2", line-strong: "#b7b7b7", text-strong: "#000000", muted: "#525252" }
  dark: { bg: "#000000", panel: "#0a0a0a", panel-2: "#141414", line: "#2b2b2b", line-strong: "#727272", text-strong: "#ffffff", muted: "#b0b0b0" }
---

# SphexPay — Design

As regras permanentes em `AGENTS.md` têm prioridade sobre este arquivo.

## Princípios

- Identidade em preto, branco e azul. O azul `#0080ff` é o acento de marca da superfície pública: ação primária, foco, progresso e destaques pontuais. Nunca como fundo de grandes áreas, exceto a aura.
- O painel (`/app`) é monocromático: o acento é o próprio preto ou branco do tema (`--orange` nos tokens legados do workspace aponta para preto ou branco). Cores semânticas só para status.
- Visual premium, tecnológico e minimalista: superfícies neutras, linhas finas, sombras suaves, muito espaço.
- O painel mantém os modos claro e escuro completos. A superfície pública (landing, cadastro, confirmação de e-mail e questionário inicial) é sempre escura, como a landing.
- Toda cor nova entra como token, nunca como hex solto em componente.
- Ícones vetoriais profissionais (SVG, traço consistente). Nunca emojis.
- Responsivo sempre: validar em 320, 375, 768, 1024, 1440 e 1920 px.

## Movimento

- Entradas com `cubic-bezier(.22,1,.36,1)`, de 0,4 a 0,7 s, subindo de 10 a 16 px; listas em cascata de 40 a 50 ms.
- Botões sobem 2 px no hover; o primário ganha brilho azul.
- Tudo respeita `prefers-reduced-motion`.

## Tipografia

- Pública: SphexGraphik, peso 400/500, `letter-spacing:-.02em`; títulos com -.035em.
- Painel: SphexDashboard; números com `font-variant-numeric: lining-nums tabular-nums`.
- Um único `h1` por página.

## Componentes do fluxo de entrada

- Campo: caixa com o rótulo dentro (12 px, cinza) e o valor abaixo (16 px). No foco, borda azul e anel `rgba(0,128,255,.28)`.
- Opção de questionário: cartão de 52 px com rádio circular. Quando marcada, borda `#3f9bff`, fundo azul translúcido e ponto azul.
- Progresso: trilho de 3 px com preenchimento em degradê azul e brilho, mais os pontos de etapa.

## Conteúdo

- Valores editáveis atuais são demonstrativos; não apresentar como dados reais.
- Nunca afirmar que pagamentos reais funcionam sem integração oficial ativa.
