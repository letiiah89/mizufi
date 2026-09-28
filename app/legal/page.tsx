export default function LegalPage() {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <a href="/" aria-label="Volver a Mizufi">← Volver a MiZUFi</a>
        <span>Borrador previo al lanzamiento</span>
        <h1>Centro legal</h1>
        <p>Información clara sobre el uso de MiZUFi, tus datos y el acceso VIP.</p>
      </header>
      <aside className="legal-draft"><strong>Documento en preparación.</strong> Los cobros reales permanecen desactivados hasta identificar a la persona o empresa responsable y revisar estos textos.</aside>
      <nav className="legal-index" aria-label="Índice legal">
        <a href="#aviso">Aviso legal</a><a href="#privacidad">Privacidad</a><a href="#cookies">Cookies</a><a href="#compra">Compra VIP</a>
      </nav>
      <section id="aviso" className="legal-section">
        <p className="legal-kicker">01</p><h2>Aviso legal</h2>
        <h3>Responsable</h3><p><strong>Pendiente antes del lanzamiento:</strong> nombre o razón social, NIF/CIF, domicilio profesional y, cuando corresponda, datos registrales.</p>
        <p>Contacto: <a href="mailto:hola@somosmizufi.com">hola@somosmizufi.com</a>. Dominio: somosmizufi.com.</p>
        <h3>Finalidad del servicio</h3><p>MiZUFi es una herramienta de organización de finanzas personales. Sus cálculos y previsiones son informativos y no constituyen asesoramiento financiero, fiscal, contable o jurídico.</p>
        <h3>Uso correcto</h3><p>La persona usuaria debe aportar información lícita, proteger sus credenciales y revisar los datos antes de tomar decisiones. No se permite intentar acceder a cuentas ajenas, alterar el servicio o utilizarlo con fines ilícitos.</p>
      </section>
      <section id="privacidad" className="legal-section">
        <p className="legal-kicker">02</p><h2>Política de privacidad</h2>
        <h3>Qué datos tratamos</h3><p>Datos de registro y acceso, como correo electrónico e identificador de usuario; la información financiera que introduces voluntariamente; datos técnicos imprescindibles para seguridad y funcionamiento; y, si compras VIP, identificadores y estado de la operación. MiZUFi no almacena los datos completos de tu tarjeta.</p>
        <h3>Para qué y con qué base</h3><p>Tratamos los datos necesarios para crear tu cuenta, prestar y proteger el servicio y guardar tus preferencias. Los datos de una compra se tratan para ejecutar el contrato, acreditar el pago y cumplir obligaciones legales.</p>
        <h3>Proveedores</h3><p>Usamos proveedores tecnológicos para autenticación, alojamiento, correo transaccional y pagos. Entre ellos pueden estar Supabase, Cloudflare/Sites, Resend y Stripe, cada uno limitado a la función necesaria.</p>
        <h3>Conservación y derechos</h3><p>Conservamos tu cuenta y datos mientras utilices MiZUFi o hasta que solicites su eliminación, salvo la información que deba mantenerse durante los plazos legales. Puedes acceder, rectificar o borrar tus datos desde la aplicación y solicitar otros derechos escribiendo a <a href="mailto:hola@somosmizufi.com">hola@somosmizufi.com</a>. También puedes reclamar ante la Agencia Española de Protección de Datos.</p>
      </section>
      <section id="cookies" className="legal-section">
        <p className="legal-kicker">03</p><h2>Política de cookies</h2>
        <p>Actualmente MiZUFi utiliza únicamente el almacenamiento y las tecnologías técnicas necesarias para iniciar sesión, mantener preferencias y prestar el servicio. Estas funciones no se usan para publicidad comportamental.</p>
        <p>Si se incorporan medición, publicidad u otras tecnologías no necesarias, se mostrará antes un panel que permita aceptar o rechazar con la misma facilidad y elegir por finalidad.</p>
        <p>Al abrir la página de pago, Stripe puede utilizar sus propias tecnologías necesarias para procesar y proteger la operación, conforme a su información de privacidad.</p>
      </section>
      <section id="compra" className="legal-section">
        <p className="legal-kicker">04</p><h2>Condiciones de compra de MiZUFi VIP</h2>
        <h3>Producto y precio</h3><p>La oferta fundadora prevista permite obtener MiZUFi VIP mediante un único pago de 4,99 €, impuestos incluidos cuando proceda, sin cuotas ni renovación automática. Está limitada a las primeras 100 compras reales aceptadas.</p>
        <h3>Qué incluye “para siempre”</h3><p>El acceso VIP se mantiene durante la vida comercial de MiZUFi para la cuenta compradora. Incluye el uso de las funciones disponibles para VIP y la ausencia de publicidad, sujeto a mejoras, cambios razonables y continuidad del servicio.</p>
        <h3>Pago y activación</h3><p>Stripe procesa el pago. El acceso se activa tras recibir la confirmación válida. Si hubiera un error, escribe a <a href="mailto:hola@somosmizufi.com">hola@somosmizufi.com</a> indicando el correo de tu cuenta, sin enviar datos de tarjeta.</p>
        <h3>Desistimiento y reembolsos</h3><p>Como borrador de lanzamiento, MiZUFi reconocerá un plazo de 14 días naturales desde la compra para solicitar la cancelación y el reembolso, sin necesidad de justificar la decisión. Esta regla se revisará jurídicamente antes de activar los cobros reales. Los derechos legales por falta de conformidad no quedan limitados.</p>
        <h3>Disponibilidad</h3><p>MiZUFi puede realizar mantenimiento, corregir errores y modificar funciones para mejorar la seguridad o el servicio. Si el proyecto cesara definitivamente, se avisaría con antelación razonable cuando resulte posible.</p>
      </section>
      <footer className="legal-footer"><p>Última actualización del borrador: 14 de septiembre de 2026.</p><a href="mailto:hola@somosmizufi.com">hola@somosmizufi.com</a></footer>
    </main>
  );
}
