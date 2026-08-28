# DE SANGOSSE App - Diretrizes de Desenvolvimento

## Aplicativo Clone / White-Label
Este projeto é irmão gêmeo do **`cropbio-app`** (localizado no diretório paralelo `../cropbio-app`).
Ambos compartilham exatamente a mesma base de código, endpoints e lógica de negócios.

### Regra de Sincronização Obrigatória:
- **Toda modificação feita neste app (`desangosse-app`) DEVE ser replicada no app irmão (`../cropbio-app`).**
- **Toda modificação feita no `cropbio-app` DEVE ser replicada aqui (`desangosse-app`).**
- **Preservar Branding**: Não sobrescrever o nome "DE SANGOSSE", package `com.nathanschiavon.desangosse` ou assets de `desangosse-app` com os do `cropbio-app`.
