// Cole este script no console do Chrome DevTools no WhatsApp Web
// Ele vai mostrar a estrutura dos módulos para corrigir os finders do wa-js

;(function () {
  const g = self || window

  console.log('=== Diagnóstico de Módulos do WhatsApp Web ===')
  console.log('')

  // Verificar tipo de loader
  const hasMeta = !!(g.require && g.__d)
  const hasWebpack = !!g.webpackChunkwhatsapp_web_client
  console.log('Loader Meta (require/__d):', hasMeta)
  console.log('Loader Webpack (webpackChunk):', hasWebpack)
  console.log('')

  if (hasMeta) {
    console.log('--- MODO LOADER META ---')
    try {
      const debug = g.require('__debug')
      const allIds = Object.keys(debug.modulesMap)
      const waIds = allIds.filter((id) => /^(?:use)?WA/.test(id))
      console.log('Total de módulos:', allIds.length)
      console.log('Módulos WA:', waIds.length)

      // Buscar módulos chave
      const buscas = {
        Conn: (id) => /Conn/i.test(id) && !/Connect|Contact|Content|Config/i.test(id),
        'Auth/Login': (id) => /auth|login|logged|register/i.test(id),
        Chat: (id) => /Chat(?:Store|Collection|Send|Message)/i.test(id),
        Contato: (id) => /Contact(?:Store|Collection|Model|Query)/i.test(id),
        'Msg/Mensagem': (id) => /Msg(?:Store|Collection|Send)|SendMessage/i.test(id),
        Stream: (id) => /Stream/i.test(id) && !/Streaming/i.test(id),
        Socket: (id) => /Socket/i.test(id),
        Rede: (id) => /Network/i.test(id),
      }

      for (const [nome, filtro] of Object.entries(buscas)) {
        const resultados = waIds.filter(filtro).slice(0, 10)
        console.log(`\n[${nome}] (${resultados.length} resultados):`)
        for (const id of resultados) {
          try {
            const mod = g.importNamespace(id)
            const keys = mod ? Object.keys(mod).slice(0, 15) : ['<nulo>']
            console.log(`  ${id} → {${keys.join(', ')}}`)
          } catch (e) {
            console.log(`  ${id} → ERRO: ${e.message}`)
          }
        }
      }

      // Buscar funções de autenticação
      console.log('\n=== Buscando funções de autenticação ===')
      const modAuth = waIds.filter((id) => /auth|login|session|register/i.test(id))
      for (const id of modAuth.slice(0, 20)) {
        try {
          const mod = g.importNamespace(id)
          if (!mod) continue
          const keys = Object.keys(mod)
          const temAuth = keys.some((k) => /auth|login|logged|register|token/i.test(k))
          if (temAuth) {
            console.log(`  ${id} →`, keys.join(', '))
          }
        } catch (e) {}
      }

      // Buscar funções de envio de mensagem
      console.log('\n=== Buscando funções de envio ===')
      const modEnvio = waIds.filter((id) => /send/i.test(id))
      for (const id of modEnvio.slice(0, 20)) {
        try {
          const mod = g.importNamespace(id)
          if (!mod) continue
          const keys = Object.keys(mod)
          console.log(`  ${id} →`, keys.join(', '))
        } catch (e) {}
      }

      // Buscar funções de consulta de contato
      console.log('\n=== Buscando funções de consulta de contato ===')
      const modContato = waIds.filter((id) => /contact|query|exist|phone|number/i.test(id))
      for (const id of modContato.slice(0, 20)) {
        try {
          const mod = g.importNamespace(id)
          if (!mod) continue
          const keys = Object.keys(mod)
          console.log(`  ${id} →`, keys.join(', '))
        } catch (e) {}
      }

      // Listar primeiros 100 nomes de módulos WA
      console.log('\n=== Primeiros 100 nomes de módulos WA ===')
      console.log(waIds.slice(0, 100).join('\n'))
    } catch (e) {
      console.error('Falha na análise do loader meta:', e)
    }
  }

  if (hasWebpack) {
    console.log('--- MODO LOADER WEBPACK ---')
    // No modo webpack, módulos são carregados de forma diferente
    // Precisamos do __webpack_require__ que só está disponível dentro do bundle
    console.log('Tamanho do chunk webpack:', g.webpackChunkwhatsapp_web_client?.length)
  }

  // Verificar se o WPP já está carregado
  if (g.WPP) {
    console.log('\n=== Status do WPP Global ===')
    console.log('WPP.isReady:', g.WPP.isReady)
    console.log('WPP.webpack.isInjected:', g.WPP.webpack?.isInjected)
    console.log('WPP.webpack.loaderType:', g.WPP.webpack?.loaderType)
    try {
      console.log('WPP.conn.isAuthenticated():', g.WPP.conn.isAuthenticated())
    } catch (e) {
      console.log('WPP.conn.isAuthenticated() ERRO:', e.message)
    }
  }

  console.log('\n=== FEITO ===')
  console.log('Copie a saída acima e cole aqui.')
})()
