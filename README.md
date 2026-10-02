# Rastreio — versão corrigida

Versão reconstruída a partir do projeto original:
https://github.com/PauloMalavasi/Projeto-Extens-o-Ludo-Logico

## Correções realizadas
- removido o botão "Instalar app";
- removido o fluxo `beforeinstallprompt`;
- removido o manifest para que o navegador não ofereça a instalação do aplicativo;
- mantido o Service Worker para funcionamento offline;
- corrigido o botão **Reiniciar sessão** para limpar todo o estado da partida;
- atualizado o cache do Service Worker e removidos caches antigos;
- adicionada regra `[hidden] { display: none !important; }`;
- adicionada validação para filtros sem cartas.

## Executar localmente
Use um servidor HTTP.

### VS Code
Abra com Live Server.

### Python
```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.
