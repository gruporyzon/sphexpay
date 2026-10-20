---
version: 1
name: SphexPay
description: Sistema visual da SphexPay — branco, preto e laranja; premium, tecnológico e minimalista, com modo claro e escuro completos. Tokens extraídos de `src/index.css` (fonte da verdade). Este arquivo documenta; não substitui o CSS.

colors:
  light:
    bg: "#f5f5f2"
    bg-elevated: "#fafaf8"
    panel: "#ffffff"
    panel-2: "#f7f7f4"
    panel-3: "#efefeb"
    text: "#171717"
    text-strong: "#090909"
    muted: "#686864"
    muted-2: "#8b8b85"
    line: "#e3e3de"
    line-strong: "#c9c9c2"
    orange: "#f15a24"
    orange-hover: "#d94a17"
    orange-active: "#c43d11"
    orange-soft: "#fff0e9"
    success: "#137a4f"
    warning: "#9a5b08"
    danger: "#b8322a"
    info: "#315e9e"
  dark:
    bg: "#030405"
    bg-elevated: "#08090b"
    panel: "#0a0b0d"
    panel-2: "#0f1113"
    panel-3: "#17191c"
    text: "#eceeed"
    text-strong: "#ffffff"
    muted: "#9a9da2"
    muted-2: "#6f7379"
    line: "rgba(255,255,255,.065)"
    line-strong: "rgba(255,255,255,.13)"
    orange: "#ff6a2f"
    orange-hover: "#ff7b45"
    orange-active: "#e95722"
    orange-soft: "rgba(255,106,47,.105)"
    positive: "#40d9a0"
    negative: "#ff6b72"
    warning: "#f4bd5c"
    info: "#70b8ff"

typography:
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

radius: { xs: 7px, sm: 10px, md: 13px, lg: 18px, xl: 24px, pill: 999px }
spacing: [4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px]
motion:
  fast: 160ms
  base: 240ms
  slow: 420ms
  ease: "cubic-bezier(.2,0,0,1)"
  ease-enter: "cubic-bezier(.22,1,.36,1)"
container: 1600px
---

# SphexPay — Design

Regras permanentes em `AGENTS.md` têm prioridade sobre este arquivo.

## Princípios

- Identidade em branco, preto e laranja. O laranja é o único acento de marca: usar em ação primária, foco, estado ativo e destaques pontuais — nunca como fundo de grandes áreas.
- Visual premium, tecnológico e minimalista: superfícies neutras, linhas finas, sombras suaves, muito espaço em branco.
- Modo claro e escuro completos. Toda cor nova entra como token nos dois temas (`:root` e `:root[data-theme=dark]`), nunca hex solto em componente.
- Ícones vetoriais profissionais (SVG, traço consistente). Nunca emojis.
- Responsivo sempre: validar em 320, 375, 768, 1024, 1440 e 1920 px.

## Cores

Usar os tokens CSS (`var(--orange)`, `var(--panel)`, `var(--line)`, `var(--muted)` etc.), não os valores. Tons derivados com `color-mix(in srgb, var(--orange) N%, var(--panel))`, como o código já faz.

- Texto sobre laranja: branco.
- Estados semânticos (sucesso, alerta, erro, info) só para status — não decorativos.

## Superfícies e profundidade

- Hierarquia `bg` → `panel` → `panel-2` → `panel-3`.
- Bordas: `--line` padrão, `--line-strong` para hover e separação forte.
- Sombras do tema (`--shadow-xs` a `--shadow-lg`); no escuro elas incluem um brilho interno de 1px no topo.

## Tipografia

- Inter como família padrão; números financeiros com `font-variant-numeric: tabular-nums`.
- Um único `h1` por página.

## Componentes

- Botão primário: fundo `--orange`, texto branco, hover `--orange-hover`, pressionado `--orange-active`, foco com anel laranja translúcido (`--spx-focus`).
- Cards/painéis: `--panel`, borda `--line`, raio `--radius-md` a `--radius-lg`.
- Inputs: fundo `--panel`, borda `--line`, foco em laranja.

## Conteúdo

- Valores editáveis atuais são demonstrativos; não apresentar como dados reais.
- Nunca afirmar que pagamentos reais funcionam sem integração oficial ativa.
