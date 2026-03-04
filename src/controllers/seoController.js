// ============================================================
// SEO Controller — Dynamic category pages for Google ranking
// Generates server-rendered HTML with proper meta tags,
// structured data (JSON-LD), and pre-rendered content
// ============================================================

const SITE_URL = 'https://lumu.dev';
const SITE_NAME = 'Lumu';

// Popular categories for Mexican e-commerce (SEO targets)
const CATEGORIES = {
    'audifonos-bluetooth': {
        title: 'Audífonos Bluetooth',
        description: 'Compara precios de audífonos bluetooth en Amazon, MercadoLibre, Walmart y más. Encuentra los mejores audífonos inalámbricos al mejor precio en México.',
        keywords: 'audifonos bluetooth, audifonos inalambricos, audifonos bluetooth baratos, mejores audifonos bluetooth mexico',
        query: 'audífonos bluetooth inalámbricos',
        emoji: '🎧',
        h1: 'Los Mejores Audífonos Bluetooth al Precio Más Bajo',
        faq: [
            { q: '¿Cuánto cuestan unos audífonos bluetooth buenos?', a: 'En México puedes encontrar audífonos bluetooth de calidad desde $200 hasta $5,000 MXN. Con Lumu comparamos precios en Amazon, MercadoLibre y Walmart para que encuentres la mejor oferta.' },
            { q: '¿Qué audífonos bluetooth recomiendan?', a: 'Las marcas más populares son Sony, JBL, Samsung y Xiaomi. Usa Lumu para comparar modelos y precios en tiempo real.' }
        ]
    },
    'celulares-baratos': {
        title: 'Celulares Baratos',
        description: 'Encuentra celulares baratos en México. Compara precios de smartphones en Amazon, MercadoLibre, Coppel y Walmart con IA.',
        keywords: 'celulares baratos, celulares baratos mexico, smartphones baratos, mejores celulares economicos',
        query: 'celulares baratos smartphone',
        emoji: '📱',
        h1: 'Celulares Baratos en México — Compara Precios con IA',
        faq: [
            { q: '¿Cuál es el celular más barato y bueno en México?', a: 'Marcas como Xiaomi, Motorola y Samsung ofrecen celulares desde $2,000 MXN con buenas especificaciones. Lumu te ayuda a encontrar el precio más bajo.' },
            { q: '¿Dónde comprar celulares baratos en México?', a: 'Las tiendas con mejores precios son Amazon MX, MercadoLibre, Coppel y Walmart. Lumu compara todas simultáneamente.' }
        ]
    },
    'laptops': {
        title: 'Laptops',
        description: 'Compara precios de laptops en México. Encuentra la mejor laptop para trabajo, estudio o gaming al mejor precio.',
        keywords: 'laptops baratas, laptops mexico, mejores laptops, laptop gamer barata, laptop para estudiantes',
        query: 'laptop computadora portatil',
        emoji: '💻',
        h1: 'Las Mejores Laptops al Precio Más Bajo en México',
        faq: [
            { q: '¿Cuánto cuesta una laptop buena en México?', a: 'Una laptop para uso general cuesta entre $8,000 y $15,000 MXN. Para gaming o trabajo profesional, desde $15,000. Lumu compara en todas las tiendas.' },
            { q: '¿Qué laptop comprar para estudiantes?', a: 'Para estudiantes las mejores opciones son Lenovo IdeaPad, HP 14, o Acer Aspire. Usa Lumu para encontrar la oferta más baja.' }
        ]
    },
    'tenis-nike': {
        title: 'Tenis Nike',
        description: 'Compara precios de tenis Nike en México. Encuentra Air Force 1, Air Max, Jordan y más al mejor precio en Amazon, MercadoLibre y tiendas oficiales.',
        keywords: 'tenis nike, tenis nike baratos, nike air force 1, nike air max, tenis nike mexico',
        query: 'tenis Nike originales',
        emoji: '👟',
        h1: 'Tenis Nike — Encuentra el Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuestan los tenis Nike en México?', a: 'Los tenis Nike van desde $1,200 hasta $5,000 MXN dependiendo del modelo. Los Air Force 1 rondan los $1,800-$2,500.' },
            { q: '¿Dónde comprar tenis Nike baratos originales?', a: 'Amazon MX, MercadoLibre y la Nike Store oficial. Lumu compara precios para que no pagues de más.' }
        ]
    },
    'smartwatch': {
        title: 'Smartwatch',
        description: 'Compara precios de smartwatch en México. Apple Watch, Samsung Galaxy Watch, Xiaomi y más. Encuentra el mejor reloj inteligente.',
        keywords: 'smartwatch, reloj inteligente, apple watch, samsung galaxy watch, smartwatch barato mexico',
        query: 'smartwatch reloj inteligente',
        emoji: '⌚',
        h1: 'Smartwatch — Relojes Inteligentes al Mejor Precio',
        faq: [
            { q: '¿Cuál es el mejor smartwatch barato?', a: 'Xiaomi Mi Band y Amazfit ofrecen excelentes opciones desde $600 MXN. Para gama alta, Apple Watch SE y Samsung Galaxy Watch.' },
            { q: '¿Vale la pena un smartwatch?', a: 'Sí, son útiles para monitorear salud, recibir notificaciones y ejercicio. Usa Lumu para comparar precios antes de comprar.' }
        ]
    },
    'consolas-videojuegos': {
        title: 'Consolas de Videojuegos',
        description: 'Compara precios de PS5, Xbox Series X, Nintendo Switch en México. Encuentra la mejor oferta en consolas de videojuegos.',
        keywords: 'ps5, xbox series x, nintendo switch, consolas baratas mexico, videojuegos',
        query: 'consola videojuegos PS5 Xbox Nintendo Switch',
        emoji: '🎮',
        h1: 'Consolas de Videojuegos — PS5, Xbox, Switch al Mejor Precio',
        faq: [
            { q: '¿Cuánto cuesta una PS5 en México?', a: 'La PS5 ronda los $10,000-$14,000 MXN. La PS5 Slim Digital es más económica. Lumu compara en Amazon, MercadoLibre y Walmart.' },
            { q: '¿Qué consola es mejor en 2026?', a: 'Depende de tus preferencias: PS5 para exclusivos, Xbox para Game Pass, Switch para portabilidad. Compara precios con Lumu.' }
        ]
    },
    'aire-acondicionado': {
        title: 'Aire Acondicionado',
        description: 'Compara precios de aires acondicionados en México. Minisplit inverter, portátil y más. Encuentra el mejor precio con IA.',
        keywords: 'aire acondicionado, minisplit, minisplit inverter, aire acondicionado barato, aire acondicionado portatil',
        query: 'aire acondicionado minisplit inverter',
        emoji: '❄️',
        h1: 'Aires Acondicionados al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta un minisplit inverter?', a: 'Un minisplit inverter de 1 tonelada va de $6,000 a $15,000 MXN. Las marcas más populares son Mirage, Hisense y Samsung.' },
            { q: '¿Cuál es el mejor aire acondicionado para casa?', a: 'Para el hogar mexicano, un minisplit inverter de 1 a 1.5 toneladas es ideal. Ahorra energía y enfría rápido.' }
        ]
    },
    'perfumes-originales': {
        title: 'Perfumes Originales',
        description: 'Compara precios de perfumes originales en México. Fragancias de hombre y mujer al mejor precio en tiendas confiables.',
        keywords: 'perfumes originales, perfumes baratos, perfumes originales baratos mexico, perfumes hombre, perfumes mujer',
        query: 'perfumes originales',
        emoji: '🧴',
        h1: 'Perfumes Originales al Mejor Precio en México',
        faq: [
            { q: '¿Dónde comprar perfumes originales baratos?', a: 'Amazon MX, MercadoLibre (vendedores oficiales) y tiendas departamentales ofrecen perfumes originales. Lumu compara para encontrar el mejor precio.' },
            { q: '¿Cómo saber si un perfume es original?', a: 'Compra en tiendas verificadas. Lumu te muestra resultados de vendedores confiables como Amazon, Liverpool y Sephora.' }
        ]
    },
    'sillas-gamer': {
        title: 'Sillas Gamer',
        description: 'Compara precios de sillas gamer en México. Sillas ergonómicas para gaming y oficina al mejor precio.',
        keywords: 'sillas gamer, silla gamer barata, silla ergonomica, silla gamer mexico',
        query: 'silla gamer ergonómica',
        emoji: '🪑',
        h1: 'Sillas Gamer Ergonómicas al Mejor Precio',
        faq: [
            { q: '¿Cuánto cuesta una silla gamer buena?', a: 'Una silla gamer de calidad va de $2,500 a $8,000 MXN. Las marcas populares son Cougar, Yeyian y ThunderX3.' },
            { q: '¿Vale la pena una silla gamer?', a: 'Sí, si pasas muchas horas sentado. Son más ergonómicas que una silla normal y previenen dolor de espalda.' }
        ]
    },
    'televisiones': {
        title: 'Televisiones',
        description: 'Compara precios de televisiones en México. Smart TV 4K, OLED, QLED al mejor precio en Amazon, MercadoLibre, Coppel y Walmart.',
        keywords: 'televisores baratos, smart tv, tv 4k, television barata mexico, oled tv',
        query: 'televisión smart TV 4K',
        emoji: '📺',
        h1: 'Televisiones Smart TV 4K al Mejor Precio',
        faq: [
            { q: '¿Cuánto cuesta una TV 4K en México?', a: 'Una Smart TV 4K de 50 pulgadas va de $5,000 a $15,000 MXN. Marcas como Hisense, TCL y Samsung ofrecen buenas opciones.' },
            { q: '¿Qué televisión comprar en 2026?', a: 'Para la mejor relación calidad-precio busca Hisense o TCL en 50-55 pulgadas. Usa Lumu para comparar en todas las tiendas.' }
        ]
    },
    'iphone': {
        title: 'iPhone',
        description: 'Compara precios de iPhone en México. iPhone 16, 15, SE y más al mejor precio en Amazon, MercadoLibre, iShop y Liverpool.',
        keywords: 'iphone precio mexico, iphone barato, iphone 16, iphone 15, donde comprar iphone mexico',
        query: 'iPhone nuevo original',
        emoji: '📱',
        h1: 'iPhone al Mejor Precio en México — Compara Tiendas',
        faq: [
            { q: '¿Cuánto cuesta un iPhone en México?', a: 'El iPhone 16 va de $18,000 a $35,000 MXN. El iPhone 15 desde $14,000 y el SE desde $8,000. Lumu compara todas las tiendas para el mejor precio.' },
            { q: '¿Dónde comprar iPhone barato y original?', a: 'Amazon MX, MercadoLibre (vendedores oficiales), iShop, Liverpool y Costco suelen tener los mejores precios. Compara con Lumu.' }
        ]
    },
    'aspiradoras-robot': {
        title: 'Aspiradoras Robot',
        description: 'Compara precios de aspiradoras robot en México. Roomba, Xiaomi, ECOVACS y más. Encuentra la mejor aspiradora inteligente al mejor precio.',
        keywords: 'aspiradora robot, roomba, aspiradora robot barata, aspiradora inteligente mexico, robot aspirador',
        query: 'aspiradora robot inteligente',
        emoji: '🤖',
        h1: 'Aspiradoras Robot al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta una aspiradora robot buena?', a: 'Desde $3,000 MXN (Xiaomi) hasta $20,000 MXN (Roomba premium). Las marcas Xiaomi y ECOVACS ofrecen la mejor relación calidad-precio.' },
            { q: '¿Vale la pena una aspiradora robot?', a: 'Sí, ahorran tiempo y mantienen tu hogar limpio automáticamente. Modelos con mapeo láser limpian más eficiente.' }
        ]
    },
    'tablets': {
        title: 'Tablets',
        description: 'Compara precios de tablets en México. iPad, Samsung Galaxy Tab, Lenovo y más al mejor precio en tiendas mexicanas.',
        keywords: 'tablet barata, ipad precio mexico, samsung galaxy tab, tablet para niños, mejor tablet',
        query: 'tablet iPad Samsung',
        emoji: '📋',
        h1: 'Tablets al Mejor Precio en México — iPad, Samsung y Más',
        faq: [
            { q: '¿Cuál es la mejor tablet barata en México?', a: 'La Samsung Galaxy Tab A y la Lenovo Tab M ofrecen buen rendimiento desde $3,000 MXN. Para gama alta, el iPad es imbatible desde $8,000.' },
            { q: '¿Qué tablet comprar para estudiar?', a: 'El iPad 10 o Samsung Galaxy Tab S6 Lite son ideales para estudiantes. Compara precios con Lumu.' }
        ]
    },
    'audifonos-gamer': {
        title: 'Audífonos Gamer',
        description: 'Compara precios de audífonos gamer en México. HyperX, Logitech, Razer y más con micrófono al mejor precio.',
        keywords: 'audifonos gamer, audifonos gamer baratos, headset gamer, audifonos con microfono gamer mexico',
        query: 'audífonos gamer con micrófono',
        emoji: '🎮',
        h1: 'Audífonos Gamer con Micrófono al Mejor Precio',
        faq: [
            { q: '¿Cuáles son los mejores audífonos gamer baratos?', a: 'HyperX Cloud Stinger y Logitech G335 son excelentes opciones desde $600 MXN. Para premium, el HyperX Cloud II desde $1,200.' },
            { q: '¿Qué audífonos gamer usan los pros?', a: 'Los profesionales usan HyperX Cloud II, SteelSeries Arctis y Logitech G Pro X. Compara precios en Lumu.' }
        ]
    },
    'tenis-adidas': {
        title: 'Tenis Adidas',
        description: 'Compara precios de tenis Adidas en México. Superstar, Stan Smith, Ultraboost y más al mejor precio en tiendas mexicanas.',
        keywords: 'tenis adidas, tenis adidas baratos, adidas superstar, adidas ultraboost, tenis adidas originales mexico',
        query: 'tenis Adidas originales',
        emoji: '👟',
        h1: 'Tenis Adidas Originales al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuestan los tenis Adidas en México?', a: 'Los tenis Adidas van desde $900 (Advantage) hasta $4,000 (Ultraboost). Los Superstar clásicos rondan $1,500-$2,200.' },
            { q: '¿Dónde comprar tenis Adidas originales?', a: 'En la tienda oficial Adidas, Amazon MX, MercadoLibre y Liverpool. Lumu compara precios en todas.' }
        ]
    },
    'refrigeradores': {
        title: 'Refrigeradores',
        description: 'Compara precios de refrigeradores en México. Samsung, LG, Whirlpool, Mabe y más al mejor precio en todas las tiendas.',
        keywords: 'refrigerador barato, refrigerador samsung, refrigerador lg, ofertas refrigeradores mexico',
        query: 'refrigerador',
        emoji: '🧊',
        h1: 'Refrigeradores al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta un refrigerador bueno?', a: 'Un refrigerador de buena calidad va de $8,000 a $25,000 MXN. Marcas como Mabe, Whirlpool y Samsung son las más populares en México.' },
            { q: '¿Qué refrigerador gasta menos luz?', a: 'Los refrigeradores con tecnología Inverter de Samsung y LG son los más eficientes. Busca la etiqueta de eficiencia energética.' }
        ]
    },
    'camaras-seguridad': {
        title: 'Cámaras de Seguridad',
        description: 'Compara precios de cámaras de seguridad en México. WiFi, exterior, interior, Xiaomi, TP-Link, Ring y más.',
        keywords: 'camaras de seguridad, camara wifi, camara vigilancia, camara seguridad exterior, ring doorbell mexico',
        query: 'cámara seguridad WiFi',
        emoji: '📷',
        h1: 'Cámaras de Seguridad al Mejor Precio en México',
        faq: [
            { q: '¿Cuál es la mejor cámara de seguridad barata?', a: 'Las cámaras Xiaomi y TP-Link Tapo ofrecen excelente calidad desde $400 MXN con WiFi, visión nocturna y detección de movimiento.' },
            { q: '¿Qué cámara de seguridad es mejor para exterior?', a: 'Ring, Eufy y Xiaomi Outdoor tienen modelos resistentes al agua desde $800 MXN. Compara con Lumu.' }
        ]
    },
    'lavadoras': {
        title: 'Lavadoras',
        description: 'Compara precios de lavadoras en México. Samsung, LG, Whirlpool, Mabe. Automáticas y semiautomáticas al mejor precio.',
        keywords: 'lavadora barata, lavadora samsung, lavadora automatica, lavadora mexico ofertas',
        query: 'lavadora automática',
        emoji: '🫧',
        h1: 'Lavadoras al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta una lavadora automática?', a: 'Una lavadora automática va de $5,000 a $20,000 MXN. Marcas como Mabe, Whirlpool y Samsung dominan el mercado mexicano.' },
            { q: '¿Qué lavadora es mejor en 2026?', a: 'Para la mayoría de los hogares, una lavadora de 16-19 kg de Samsung o LG es ideal. Lumu te ayuda a comparar precios.' }
        ]
    },
    'bocinas-bluetooth': {
        title: 'Bocinas Bluetooth',
        description: 'Compara precios de bocinas bluetooth en México. JBL, Sony, Marshall, Ultimate Ears y más al mejor precio.',
        keywords: 'bocina bluetooth, bocina jbl, bocina portatil, bocina bluetooth barata mexico',
        query: 'bocina bluetooth portátil',
        emoji: '🔊',
        h1: 'Bocinas Bluetooth Portátiles al Mejor Precio',
        faq: [
            { q: '¿Cuál es la mejor bocina bluetooth barata?', a: 'La JBL Go 3 y la JBL Clip 4 son excelentes opciones desde $600 MXN. Para más potencia, la JBL Flip 6 desde $1,500.' },
            { q: '¿Qué bocina bluetooth tiene mejor sonido?', a: 'JBL, Sony y Marshall son las marcas con mejor calidad de sonido. Compara precios en Lumu antes de comprar.' }
        ]
    },
    'mochilas': {
        title: 'Mochilas',
        description: 'Compara precios de mochilas en México. Para laptop, escuela, viaje, senderismo. Nike, Under Armour, SwissGear y más.',
        keywords: 'mochilas baratas, mochila para laptop, mochila escolar, mochila viaje, mochila nike mexico',
        query: 'mochila para laptop escolar',
        emoji: '🎒',
        h1: 'Mochilas al Mejor Precio — Escuela, Laptop y Viaje',
        faq: [
            { q: '¿Cuánto cuesta una buena mochila para laptop?', a: 'Una mochila de calidad para laptop va de $400 a $2,000 MXN. SwissGear, Samsonite y Nike son marcas populares.' },
            { q: '¿Qué mochila comprar para la escuela?', a: 'Para estudiantes, Nike, Adidas y Under Armour ofrecen mochilas resistentes desde $500 MXN.' }
        ]
    },
    'lentes-sol': {
        title: 'Lentes de Sol',
        description: 'Compara precios de lentes de sol en México. Ray-Ban, Oakley, Hawkers y más. Lentes originales al mejor precio.',
        keywords: 'lentes de sol, lentes ray ban, lentes sol baratos, lentes oakley, lentes de sol originales mexico',
        query: 'lentes de sol originales',
        emoji: '🕶️',
        h1: 'Lentes de Sol Originales al Mejor Precio en México',
        faq: [
            { q: '¿Dónde comprar lentes de sol originales baratos?', a: 'Amazon MX, MercadoLibre y Sunglass Hut ofrecen lentes originales. Hawkers tiene opciones desde $500 MXN. Compara con Lumu.' },
            { q: '¿Cuánto cuestan unos Ray-Ban en México?', a: 'Los Ray-Ban van de $2,000 a $5,000 MXN dependiendo del modelo. Lumu te ayuda a encontrar el mejor precio.' }
        ]
    },
    'colchones': {
        title: 'Colchones',
        description: 'Compara precios de colchones en México. Spring Air, Serta, Luuna, Nooz y más. Matrimonial, individual y king size.',
        keywords: 'colchon barato, colchon matrimonial, colchon individual, colchon memoria, mejor colchon mexico',
        query: 'colchón matrimonial',
        emoji: '🛏️',
        h1: 'Colchones al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta un buen colchón en México?', a: 'Un colchón matrimonial de calidad va de $3,000 a $15,000 MXN. Marcas como Spring Air, Luuna y Serta son populares.' },
            { q: '¿Qué colchón es mejor para la espalda?', a: 'Los colchones de memory foam como Luuna o Nooz ofrecen buen soporte. Compara precios y opiniones con Lumu.' }
        ]
    },
    'teclados-mecanicos': {
        title: 'Teclados Mecánicos',
        description: 'Compara precios de teclados mecánicos en México. Logitech, Razer, HyperX, Keychron y más para gaming y oficina.',
        keywords: 'teclado mecanico, teclado mecanico barato, teclado gamer, teclado mecanico mexico',
        query: 'teclado mecánico gamer',
        emoji: '⌨️',
        h1: 'Teclados Mecánicos al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta un teclado mecánico bueno?', a: 'Un teclado mecánico de calidad va de $700 a $3,000 MXN. Redragon y Logitech ofrecen opciones accesibles desde $600.' },
            { q: '¿Qué teclado mecánico comprar para gaming?', a: 'Para gaming: Redragon, HyperX Alloy y Razer Huntsman son populares. Compara precios con Lumu.' }
        ]
    },
    'patines-electricos': {
        title: 'Patines Eléctricos',
        description: 'Compara precios de scooters y patines eléctricos en México. Xiaomi, Ninebot, Segway y más al mejor precio.',
        keywords: 'patin electrico, scooter electrico, patin electrico xiaomi, patineta electrica mexico',
        query: 'scooter eléctrico patín',
        emoji: '🛴',
        h1: 'Patines Eléctricos y Scooters al Mejor Precio',
        faq: [
            { q: '¿Cuánto cuesta un patín eléctrico en México?', a: 'Un patín eléctrico va de $5,000 a $25,000 MXN. Los Xiaomi y Ninebot son los más populares desde $6,000.' },
            { q: '¿Qué scooter eléctrico es bueno y barato?', a: 'El Xiaomi Mi Electric Scooter ofrece la mejor relación calidad-precio. Compara modelos con Lumu.' }
        ]
    },
    'microfonos': {
        title: 'Micrófonos',
        description: 'Compara precios de micrófonos en México. Micrófonos USB, condensador, dinámicos para streaming, podcast y música.',
        keywords: 'microfono, microfono usb, microfono condensador, microfono para streaming, microfono barato mexico',
        query: 'micrófono USB condensador streaming',
        emoji: '🎙️',
        h1: 'Micrófonos al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta un buen micrófono para streaming?', a: 'Un micrófono USB de calidad va de $500 a $3,000 MXN. El HyperX SoloCast y Blue Yeti son opciones muy populares.' },
            { q: '¿Qué micrófono recomiendan para podcast?', a: 'Para podcasts, el Blue Yeti, Rode NT-USB y Audio-Technica AT2020 son excelentes. Compara precios con Lumu.' }
        ]
    },
    'freidoras-aire': {
        title: 'Freidoras de Aire',
        description: 'Compara precios de freidoras de aire (air fryer) en México. Gourmia, Ninja, Oster, Cosori y más al mejor precio.',
        keywords: 'freidora de aire, air fryer, freidora de aire barata, freidora sin aceite mexico, air fryer mexico',
        query: 'freidora de aire air fryer',
        emoji: '🍟',
        h1: 'Freidoras de Aire al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta una freidora de aire en México?', a: 'Una freidora de aire va de $800 a $5,000 MXN. Marcas como Gourmia, Ninja y Oster son las más vendidas.' },
            { q: '¿Qué freidora de aire comprar?', a: 'Para familias pequeñas de 3.5-5L es ideal. Para familias grandes, busca de 8L o más. Lumu compara en todas las tiendas.' }
        ]
    },
    'impresoras': {
        title: 'Impresoras',
        description: 'Compara precios de impresoras en México. HP, Epson, Canon, Brother. Impresoras láser, inyección de tinta y multifuncionales.',
        keywords: 'impresora, impresora barata, impresora epson, impresora hp, impresora laser, impresora multifuncional mexico',
        query: 'impresora multifuncional',
        emoji: '🖨️',
        h1: 'Impresoras al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta una impresora multifuncional?', a: 'Una impresora multifuncional va de $1,500 a $6,000 MXN. Epson EcoTank y HP Smart Tank son populares por su bajo costo en tinta.' },
            { q: '¿Qué impresora gasta menos tinta?', a: 'Las impresoras con tanque de tinta (Epson EcoTank, HP Smart Tank) ahorran hasta 90% vs cartuchos. Compara con Lumu.' }
        ]
    },
    'monitores': {
        title: 'Monitores',
        description: 'Compara precios de monitores en México. Monitores gaming 144Hz, 4K, ultrawide, Samsung, LG, ASUS al mejor precio.',
        keywords: 'monitor, monitor gamer, monitor 4k, monitor 144hz, monitor barato mexico, monitor ultrawide',
        query: 'monitor gaming 144hz',
        emoji: '🖥️',
        h1: 'Monitores al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta un monitor gamer?', a: 'Un monitor gaming 144Hz va de $3,000 a $12,000 MXN. Las marcas ASUS, Samsung y LG tienen opciones para todos los presupuestos.' },
            { q: '¿Qué monitor comprar para diseño gráfico?', a: 'Para diseño, busca monitores con panel IPS y buena cobertura sRGB. LG y ASUS ProArt son excelentes opciones.' }
        ]
    },
    'camisetas-futbol': {
        title: 'Camisetas de Fútbol',
        description: 'Compara precios de jerseys de fútbol en México. América, Chivas, Cruz Azul, Selección Mexicana y más al mejor precio.',
        keywords: 'jersey futbol, camiseta futbol, jersey america, jersey chivas, jersey seleccion mexicana, playera futbol mexico',
        query: 'jersey fútbol original',
        emoji: '⚽',
        h1: 'Jerseys de Fútbol Originales al Mejor Precio',
        faq: [
            { q: '¿Cuánto cuesta un jersey de fútbol original?', a: 'Un jersey original va de $800 a $2,500 MXN. Los de la Selección Mexicana y clubes como América y Chivas son los más buscados.' },
            { q: '¿Dónde comprar jerseys de fútbol originales?', a: 'En la tienda oficial del club, Amazon MX, MercadoLibre y Innovasport. Lumu te ayuda a comparar precios.' }
        ]
    },
    'power-bank': {
        title: 'Power Banks',
        description: 'Compara precios de baterías portátiles y power banks en México. Xiaomi, Anker, Samsung y más al mejor precio.',
        keywords: 'power bank, bateria portatil, power bank barata, cargador portatil, power bank xiaomi mexico',
        query: 'power bank batería portátil',
        emoji: '🔋',
        h1: 'Power Banks al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta un power bank bueno?', a: 'Un power bank de 10,000mAh va de $250 a $800 MXN. Xiaomi, Anker y Samsung ofrecen las mejores opciones.' },
            { q: '¿Cuántas cargas da un power bank de 20,000mAh?', a: 'Un power bank de 20,000mAh carga un celular promedio 4-5 veces. Ideal para viajes largos.' }
        ]
    },
    'cafeteras': {
        title: 'Cafeteras',
        description: 'Compara precios de cafeteras en México. Nespresso, Dolce Gusto, cafeteras de goteo, espresso y más al mejor precio.',
        keywords: 'cafetera, cafetera nespresso, cafetera dolce gusto, cafetera barata, cafetera espresso mexico',
        query: 'cafetera espresso Nespresso',
        emoji: '☕',
        h1: 'Cafeteras al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta una cafetera Nespresso?', a: 'Las máquinas Nespresso van de $1,500 a $6,000 MXN. La Vertuo Pop y la Essenza Mini son las más accesibles.' },
            { q: '¿Qué cafetera es mejor para casa?', a: 'Para café rápido: cápsulas (Nespresso/Dolce Gusto). Para café artesanal: prensa francesa o cafetera italiana. Compara con Lumu.' }
        ]
    },
    'bicicletas': {
        title: 'Bicicletas',
        description: 'Compara precios de bicicletas en México. Montaña, ruta, urbana, eléctrica. Benotto, Alubike, Mercurio y más.',
        keywords: 'bicicleta, bicicleta barata, bicicleta montaña, bicicleta electrica, bicicleta mexico',
        query: 'bicicleta',
        emoji: '🚲',
        h1: 'Bicicletas al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta una bicicleta buena en México?', a: 'Una bicicleta de montaña va de $3,000 a $15,000 MXN. Benotto, Mercurio y Alubike son marcas populares mexicanas.' },
            { q: '¿Qué bicicleta comprar para la ciudad?', a: 'Para uso urbano, bicicletas tipo fixie o urbana son ideales desde $3,000. Las bicicletas plegables son prácticas para transporte público.' }
        ]
    },
    'maletas-viaje': {
        title: 'Maletas de Viaje',
        description: 'Compara precios de maletas de viaje en México. Samsonite, American Tourister, maletas de cabina y más al mejor precio.',
        keywords: 'maleta viaje, maleta de cabina, maleta samsonite, maleta barata, equipaje mexico',
        query: 'maleta viaje cabina',
        emoji: '🧳',
        h1: 'Maletas de Viaje al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta una maleta de cabina?', a: 'Una maleta de cabina va de $600 a $5,000 MXN. American Tourister y marcas nacionales ofrecen buenas opciones desde $800.' },
            { q: '¿Qué maleta comprar para viajar en avión?', a: 'Para carry-on busca maletas de 55x40x20 cm. Samsonite, American Tourister y Swiss Gear son confiables. Compara en Lumu.' }
        ]
    },
    'protectores-pantalla': {
        title: 'Protectores de Pantalla',
        description: 'Compara precios de cristales templados y protectores de pantalla en México para iPhone, Samsung, Xiaomi y más.',
        keywords: 'protector pantalla, cristal templado, mica celular, protector pantalla iphone, cristal templado samsung mexico',
        query: 'cristal templado protector pantalla',
        emoji: '📱',
        h1: 'Protectores de Pantalla al Mejor Precio',
        faq: [
            { q: '¿Cuánto cuesta un cristal templado?', a: 'Un cristal templado va de $50 a $500 MXN dependiendo de la marca y modelo de celular. Los premium ofrecen mejor protección.' },
            { q: '¿Qué protector de pantalla es mejor?', a: 'Los cristales templados 9H de Spigen, ESR y Ringke son los más recomendados. Compara precios con Lumu.' }
        ]
    },
    'juguetes': {
        title: 'Juguetes',
        description: 'Compara precios de juguetes en México. LEGO, Hot Wheels, Barbie, Nerf y más. Juguetes para niños al mejor precio.',
        keywords: 'juguetes, lego, hot wheels, barbie, juguetes baratos mexico, juguetes para niños',
        query: 'juguetes LEGO Hot Wheels',
        emoji: '🧸',
        h1: 'Juguetes al Mejor Precio en México',
        faq: [
            { q: '¿Dónde comprar juguetes baratos en México?', a: 'Amazon MX, MercadoLibre, Coppel y Walmart tienen ofertas frecuentes. En temporada navideña hay hasta 50% de descuento.' },
            { q: '¿Cuánto cuestan los LEGO en México?', a: 'Los sets LEGO van de $200 a $10,000+ MXN. Los sets Classic empiezan desde $350. Compara con Lumu para el mejor precio.' }
        ]
    },
    'herramientas': {
        title: 'Herramientas',
        description: 'Compara precios de herramientas en México. Taladros, desarmadores, llaves, Truper, DeWalt, Makita y más.',
        keywords: 'herramientas, taladro, desarmador, herramientas baratas, truper, dewalt, makita mexico',
        query: 'herramientas taladro DeWalt Makita',
        emoji: '🔧',
        h1: 'Herramientas al Mejor Precio en México',
        faq: [
            { q: '¿Cuánto cuesta un taladro bueno en México?', a: 'Un taladro inalámbrico va de $800 a $5,000 MXN. Marcas como DeWalt, Makita y Truper son las más confiables.' },
            { q: '¿Qué marca de herramientas es mejor?', a: 'Para uso profesional: DeWalt, Makita, Bosch. Para hogar: Truper y Pretul. Compara precios en Lumu.' }
        ]
    }
};

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateCategoryHTML(slug, cat) {
    const url = `${SITE_URL}/buscar/${slug}`;
    const faqJsonLd = cat.faq.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
    }));

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(cat.title)} — Compara Precios en México | ${SITE_NAME}</title>
    <meta name="description" content="${esc(cat.description)}">
    <meta name="keywords" content="${esc(cat.keywords)}">
    <link rel="canonical" href="${url}">
    <meta property="og:title" content="${esc(cat.title)} — Compara Precios | ${SITE_NAME}">
    <meta property="og:description" content="${esc(cat.description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${SITE_URL}/images/og-cover.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(cat.title)} — ${SITE_NAME}">
    <meta name="twitter:description" content="${esc(cat.description)}">
    <meta name="twitter:image" content="${SITE_URL}/images/og-cover.png">
    <meta name="robots" content="index, follow">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' fill='none'><path d='M10 18h28l-3 22H13L10 18z' stroke='%2310B981' stroke-width='3' stroke-linejoin='round'/><path d='M17 18V14a7 7 0 0114 0v4' stroke='%2310B981' stroke-width='3' stroke-linecap='round'/></svg>">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <meta name="google-adsense-account" content="ca-pub-7394172038398161">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7394172038398161" crossorigin="anonymous"></script>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "${esc(cat.title)} — Comparador de Precios",
        "description": "${esc(cat.description)}",
        "url": "${url}",
        "publisher": {
            "@type": "Organization",
            "name": "${SITE_NAME}",
            "url": "${SITE_URL}",
            "logo": "${SITE_URL}/images/og-cover.png"
        },
        "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "${SITE_URL}" },
                { "@type": "ListItem", "position": 2, "name": "${esc(cat.title)}", "item": "${url}" }
            ]
        }
    }
    </script>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": ${JSON.stringify(faqJsonLd)}
    }
    </script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Outfit', system-ui, sans-serif; background: #f8fafc; color: #1e293b; }
        .container { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
        header { background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%); color: white; padding: 3rem 1rem; text-align: center; }
        header h1 { font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; }
        header p { font-size: 1.1rem; opacity: 0.9; max-width: 600px; margin: 0 auto 1.5rem; }
        .cta-btn { display: inline-block; background: #10B981; color: white; padding: 1rem 2.5rem; border-radius: 1rem; font-weight: 700; font-size: 1.1rem; text-decoration: none; transition: background 0.2s; }
        .cta-btn:hover { background: #059669; }
        .breadcrumb { padding: 1rem; font-size: 0.875rem; color: #64748b; }
        .breadcrumb a { color: #10B981; text-decoration: none; }
        .breadcrumb a:hover { text-decoration: underline; }
        .section { background: white; border-radius: 1rem; padding: 2rem; margin-bottom: 1.5rem; border: 1px solid #e2e8f0; }
        .section h2 { font-size: 1.4rem; font-weight: 700; margin-bottom: 1rem; color: #0f172a; }
        .section p { line-height: 1.8; color: #475569; margin-bottom: 1rem; }
        .faq-item { border-bottom: 1px solid #f1f5f9; padding: 1.25rem 0; }
        .faq-item:last-child { border-bottom: none; }
        .faq-item h3 { font-size: 1.05rem; font-weight: 700; color: #1e293b; margin-bottom: 0.5rem; }
        .faq-item p { margin-bottom: 0; }
        .stores-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem; margin-top: 1rem; }
        .store-badge { background: #f1f5f9; padding: 0.75rem; border-radius: 0.75rem; text-align: center; font-weight: 600; font-size: 0.9rem; }
        .categories-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; margin-top: 1.5rem; }
        .cat-link { display: block; padding: 1rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; text-decoration: none; color: #1e293b; font-weight: 600; transition: all 0.2s; }
        .cat-link:hover { border-color: #10B981; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15); }
        footer { text-align: center; padding: 2rem 1rem; color: #94a3b8; font-size: 0.875rem; }
        footer a { color: #10B981; text-decoration: none; }
        @media (max-width: 640px) { header h1 { font-size: 1.5rem; } .cta-btn { padding: 0.875rem 2rem; font-size: 1rem; } }
    </style>
</head>
<body>
    <nav class="breadcrumb container">
        <a href="/">Lumu</a> &rsaquo; <a href="/buscar">Categorías</a> &rsaquo; <strong>${esc(cat.title)}</strong>
    </nav>

    <header>
        <div style="font-size:3rem;margin-bottom:0.5rem">${cat.emoji}</div>
        <h1>${esc(cat.h1)}</h1>
        <p>${esc(cat.description)}</p>
        <a href="/?q=${encodeURIComponent(cat.query)}" class="cta-btn">Comparar Precios Ahora</a>
    </header>

    <div class="container">
        <section class="section">
            <h2>¿Por qué comparar precios de ${esc(cat.title.toLowerCase())} con Lumu?</h2>
            <p><strong>Lumu</strong> es tu Personal Shopper con Inteligencia Artificial. En segundos comparamos precios en <strong>Amazon MX, MercadoLibre, Walmart, Coppel</strong> y más tiendas mexicanas para que siempre pagues el precio más bajo.</p>
            <p>No más abrir 10 pestañas. Solo escribe lo que buscas y nuestra IA encuentra el mejor precio por ti.</p>
            <div class="stores-grid">
                <div class="store-badge">🛒 Amazon MX</div>
                <div class="store-badge">🟡 MercadoLibre</div>
                <div class="store-badge">🔵 Walmart MX</div>
                <div class="store-badge">🟠 Coppel</div>
                <div class="store-badge">🏪 Tiendas locales</div>
                <div class="store-badge">🌐 AliExpress</div>
            </div>
        </section>

        <section class="section">
            <h2>Preguntas Frecuentes</h2>
            ${cat.faq.map(f => `
            <div class="faq-item">
                <h3>${esc(f.q)}</h3>
                <p>${esc(f.a)}</p>
            </div>`).join('')}
        </section>

        <section class="section">
            <h2>Otras Categorías Populares</h2>
            <div class="categories-grid">
                ${Object.entries(CATEGORIES)
                    .filter(([s]) => s !== slug)
                    .slice(0, 8)
                    .map(([s, c]) => `<a href="/buscar/${s}" class="cat-link">${c.emoji} ${esc(c.title)}</a>`)
                    .join('')}
            </div>
        </section>
    </div>

    <footer>
        <p>&copy; ${new Date().getFullYear()} <a href="/">${SITE_NAME}</a> — Personal Shopper AI para México</p>
        <p style="margin-top:0.5rem"><a href="/terminos.html">Términos</a> · <a href="/privacidad.html">Privacidad</a></p>
    </footer>
</body>
</html>`;
}

function generateCategoryIndex() {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comparar Precios en México — Categorías | ${SITE_NAME}</title>
    <meta name="description" content="Explora categorías populares y compara precios en Amazon, MercadoLibre, Walmart y más tiendas mexicanas con inteligencia artificial.">
    <link rel="canonical" href="${SITE_URL}/buscar">
    <meta property="og:title" content="Comparar Precios — Categorías | ${SITE_NAME}">
    <meta property="og:description" content="Explora categorías populares y compara precios en México con IA.">
    <meta property="og:url" content="${SITE_URL}/buscar">
    <meta property="og:image" content="${SITE_URL}/images/og-cover.png">
    <meta name="robots" content="index, follow">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' fill='none'><path d='M10 18h28l-3 22H13L10 18z' stroke='%2310B981' stroke-width='3' stroke-linejoin='round'/><path d='M17 18V14a7 7 0 0114 0v4' stroke='%2310B981' stroke-width='3' stroke-linecap='round'/></svg>">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <meta name="google-adsense-account" content="ca-pub-7394172038398161">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7394172038398161" crossorigin="anonymous"></script>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Categorías de Productos",
        "description": "Explora categorías populares y compara precios en México",
        "url": "${SITE_URL}/buscar",
        "publisher": { "@type": "Organization", "name": "${SITE_NAME}" }
    }
    </script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Outfit', system-ui, sans-serif; background: #f8fafc; color: #1e293b; }
        .container { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
        header { background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%); color: white; padding: 3rem 1rem; text-align: center; }
        header h1 { font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; }
        header p { font-size: 1.1rem; opacity: 0.9; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin-top: 2rem; }
        .card { display: block; padding: 1.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 1rem; text-decoration: none; color: #1e293b; transition: all 0.2s; }
        .card:hover { border-color: #10B981; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.12); transform: translateY(-2px); }
        .card .emoji { font-size: 2rem; margin-bottom: 0.5rem; }
        .card h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; }
        .card p { font-size: 0.85rem; color: #64748b; line-height: 1.5; }
        .cta-section { text-align: center; margin-top: 3rem; }
        .cta-btn { display: inline-block; background: #10B981; color: white; padding: 1rem 2.5rem; border-radius: 1rem; font-weight: 700; font-size: 1.1rem; text-decoration: none; }
        .cta-btn:hover { background: #059669; }
        footer { text-align: center; padding: 2rem; color: #94a3b8; font-size: 0.875rem; }
        footer a { color: #10B981; text-decoration: none; }
    </style>
</head>
<body>
    <header>
        <div style="font-size:3rem;margin-bottom:0.5rem">🛍️</div>
        <h1>Compara Precios en México</h1>
        <p>Explora categorías populares y encuentra el mejor precio con IA</p>
    </header>
    <div class="container">
        <div class="grid">
            ${Object.entries(CATEGORIES).map(([slug, cat]) => `
            <a href="/buscar/${slug}" class="card">
                <div class="emoji">${cat.emoji}</div>
                <h2>${esc(cat.title)}</h2>
                <p>${esc(cat.description.slice(0, 100))}...</p>
            </a>`).join('')}
        </div>
        <div class="cta-section">
            <p style="margin-bottom:1rem;color:#64748b">¿No ves lo que buscas? Busca cualquier producto</p>
            <a href="/" class="cta-btn">Buscar con IA</a>
        </div>
    </div>
    <footer>
        <p>&copy; ${new Date().getFullYear()} <a href="/">${SITE_NAME}</a> — Personal Shopper AI para México</p>
    </footer>
</body>
</html>`;
}

exports.serveCategoryPage = (req, res) => {
    const { slug } = req.params;

    if (!slug) {
        // Category index page
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        return res.send(generateCategoryIndex());
    }

    const category = CATEGORIES[slug];
    if (!category) {
        // Unknown category — redirect to index
        return res.redirect(301, '/buscar');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.send(generateCategoryHTML(slug, category));
};

exports.serveCategoryIndex = (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.send(generateCategoryIndex());
};

// Export categories for sitemap generation
exports.CATEGORIES = CATEGORIES;
exports.SITE_URL = SITE_URL;
