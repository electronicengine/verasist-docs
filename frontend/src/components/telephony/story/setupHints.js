// Setup locations are based on the existing SIP/PBX guides; packet exchanges remain automatic.
export function setupHints(scenario,phase,lang='tr') {
  const en=lang==='en',id=scenario.id,title=phase.title,target=scenario.target.id;
  if(phase.setup&&id!=='mechanism')return {mode:'setup',items:phase.setup[lang]||phase.setup.tr};
  if(scenario.connectionModel||scenario.phoneModel||scenario.fxoModel)return {mode:'automatic',items:[{where:en?'Configured PBX / Verasist runtime':'Yapılandırılmış PBX / Verasist çalışma zamanı',steps:[en?'The previously configured routes and network settings are used automatically. Inspect this step to follow its control and audio paths.':'Önceki adımlarda tanımlanan rota ve ağ ayarları otomatik kullanılır. Bu adımın mesaj ve ses yollarını inceleyin.']}]};
  if(id==='mechanism'){
    if(phase.setup)return {mode:'setup',items:phase.setup[lang]||phase.setup.tr};
    return {mode:'automatic',items:[{where:en?'Verasist runtime → Current workflow run':'Verasist çalışma zamanı → Geçerli çağrı çalışması',steps:en?[
      'This runtime step uses the validated organization, selected telephony configuration, pinned workflow definition and resolved model package prepared earlier.',
      'The engine and media transport process this call’s context, text/tool events and audio frames automatically. No per-frame panel setting or manual JSON request is required.'
    ]:[
      'Bu çalışma zamanı adımı önceden doğrulanmış organizasyon, seçili telefon yapılandırması, sabitlenmiş iş akışı tanımı ve çözülmüş model paketini kullanır.',
      'Motor ve medya transport’u bu görüşmenin bağlamını, metin/araç olaylarını ve ses frame’lerini otomatik işler. Her frame için panel ayarı veya elle JSON gönderimi yapılmaz.'
    ]}]};
  }
  const pick=(tr,eng)=>en?eng:tr;
  const card=(trWhere,enWhere,trSteps,enSteps)=>({where:pick(trWhere,enWhere),steps:en?enSteps:trSteps});
  const result=(items,mode='setup')=>({mode,items});
  const phone=()=>card(target==='301'?'ATA yönetimi → FXS / SIP hesabı':'IP telefon → SIP hesabı / Account',target==='301'?'ATA admin → FXS / SIP account':'IP phone → SIP account / Account',[
    `Registrar / SIP Server: kurum santralinin SIP adresi. Username / Auth ID: ${target}; parola: santralde bu hesaba verilen parola.`,
    target==='301'?'301 hesabını analog telefonun bağlı olduğu FXS portuyla eşleyin; RJ11 telefonun kendisine SIP bilgisi girilmez.':'Telefonu Ethernet ağına bağlayın; bu dahili için ayrı hesap kullanın.'
  ],[`Registrar / SIP Server: office PBX SIP address. Username / Auth ID: ${target}; password: the credentials provisioned on the PBX.`,target==='301'?'Map account 301 to the FXS port holding the analog phone; SIP credentials are not entered on the RJ11 handset.':'Connect the phone to the Ethernet network and use a separate extension account.']);
  const pbx=()=>card('Kurum santrali → Dahililer / Gelen kurallar','Office PBX → Extensions / Inbound rules',[
    `${target} hesabını oluşturun, telefonun/ATA’nın kaydını kontrol edin. Normal gelen aramada DID hedefini ${target} olarak seçin.`,
    'Operatör trunk’ının izinli kaynaklarını ve G.711 codec uyumunu ayarlayın.'
  ],[`Create account ${target} and verify phone/ATA registration. For normal incoming calls, route the DID to ${target}.`,'Configure the operator trunk’s allowed peers and G.711 codec compatibility.']);
  const trunk=peer=>card('Verasist → Telefon Yapılandırmaları → SIP Trunk','Verasist → Telephony configurations → SIP Trunk',[
    `SIP Gateway IP: ${peer==='operator'?'operatörün':'santralin'} erişilebilir SIP sunucusu; SIP Gateway Port: verilen UDP portu. Telefonun IP’si veya HTTPS panel adresi kullanılmaz.`,
    'SIP Username / SIP Password ve From User / DID: bu trunk için sağlanan bilgiler. From Numbers: izinli arayan kimlikleri. Enable Registration: yalnız Verasist karşı sunucuya REGISTER gönderecekse true; IP eşleşmeli bağlantıda false.',
    'Yönetilen ARI Endpoint, Stasis App Name, ARI Password ve websocket_client.conf Name alanları Verasist altyapısına aittir; operatör parolası bu alanlara girilmez.'
  ],[`SIP Gateway IP: the reachable ${peer==='operator'?'operator':'PBX'} SIP server; SIP Gateway Port: its assigned UDP port. Use neither the phone IP nor the HTTPS panel address.`,'SIP Username / SIP Password and From User / DID: the assigned trunk credentials. From Numbers: allowed caller identities. Enable Registration is true only when Verasist must send REGISTER to that server; use false for IP-peered connections.','Managed ARI Endpoint, Stasis App Name, ARI Password and websocket_client.conf Name belong to Verasist infrastructure, not the operator credentials.']);
  const number=()=>card('Verasist → Telefon Yapılandırmaları → Telefon numaraları','Verasist → Telephony configurations → Phone numbers',[
    'Karşı tarafın INVITE içinde gönderdiği ajan DID’sini ekleyin, aktif tutun ve yayımlanmış Gelen arama iş akışını seçin.',
    'Genel şebeke numarasını ülke kodu ve + ile tanımlayın. Numarayı kaydetmek, operatörün/santralin gelen rotasını kendiliğinden oluşturmaz.'
  ],['Add the agent DID sent in the incoming INVITE, keep it active and select a published Inbound workflow.','Enter public numbers with country code and +. Saving the number does not automatically create inbound routing on the operator or PBX.']);
  const agent=()=>card('Verasist → İlgili gelen arama iş akışı / Ajan','Verasist → Assigned inbound workflow / Agent',[
    'Karşılama talimatını, konuşma dilini ve ses/model ayarlarını bu akışta tanımlayıp yayımlayın.',
    'Departman–hedef eşlemesini ve Call Transfer aracının izinli hedeflerini ayarlayın; numaranın yayımlanmış bu akışa bağlı olduğunu kontrol edin.'
  ],['Set and publish the greeting instructions, language and voice/model choices in this workflow.','Configure the department-to-destination mapping and allowed Call Transfer targets; verify that the phone number uses this published workflow.']);
  const transfer=(direct=false)=>card('Verasist → İş akışı → Call Transfer','Verasist → Workflow → Call Transfer',[
    direct?'Hedef: operatörün kayıtlı telefona ulaştırdığı ayrı personel numarası/SIP hedefi. Örnekte 12025550201; ana numara 12025550101 değildir.':`Hedef: santralin yönlendirebildiği ${target} dahilisi veya izinli personel hedefi.`,
    `Giden bağlantı: ${direct?'operatör':'kurum santrali'} için eklenen SIP yapılandırması. Karşı tarafta bu hedefe arama izni ve uygun arayan kimliği tanımlı olmalıdır.`
  ],[direct?'Destination: the separate staff number/SIP target that the operator routes to the registered phone. The example uses 12025550201, not main number 12025550101.':`Destination: extension ${target}, or an allowed staff destination that the PBX can route.`,`Outbound connection: the SIP configuration for the ${direct?'operator':'office PBX'}. That peer must allow the destination and calling identity.`]);
  const pbxToVera=()=>card('Kurum santrali → Trunk / Gelen–giden kurallar','Office PBX → Trunk / Inbound–outbound rules',[
    'Verasist SIP ağ geçidine özel trunk/hesap tanımlayın; verilen sinyalleşme ve medya adreslerini kullanın.',
    'İlk karşılamada ana DID’nin gelen hedefini Verasist trunk’ı yapın. Giden INVITE’ın hedefini Verasist’te tanımlı ajan DID’sine eşleyin.',
    `Verasist’ten geri aranan ${target} dahilisini bu trunk için izinli yerel hedef olarak yönlendirin.`
  ],['Create a dedicated trunk/account for the Verasist SIP gateway using the assigned signaling and media addresses.','For AI reception, route the main DID to the Verasist trunk and map the outbound INVITE target to the assigned Verasist agent DID.',`Route extension ${target} as an allowed local destination for calls returning from Verasist.`]);
  const virtual700=()=>card('Kurum santrali → Sanal hedef 700 / Arama kuralı','Office PBX → Virtual destination 700 / Dial rule',[
    '700’ü yerel hedef olarak tanımlayın; bu hedefi Verasist trunk’ına ve atanmış ajan DID’sine eşleyin.',
    'Verasist’e yalnız 700 rakamını göndermek yerine, karşıda tanımlanmış ajan DID’sine dönüşümü ayarlayın. Personelin bu hedefe aktarma yetkisini açın.'
  ],['Create local destination 700 and route it through the Verasist trunk to the assigned agent DID.','Rewrite local 700 to the agent DID configured at Verasist, rather than assuming bare 700 will match there. Allow staff to transfer calls to this destination.']);
  const operatorPhone=()=>card('Operatör paneli / desteği → SIP hesapları ve numara rotası','Operator portal / support → SIP accounts and number routing',[
    'IP telefon kaydı destekleyen SIP hesabını ve dış numarayı sağlayın. İlk aşamada gelen numara bu kayıtlı telefon hesabına yönlenir.',
    'Telefon için registrar, kullanıcı adı, parola, varsa outbound proxy ve izinli medya bilgilerini operatörden alın; her SIP trunk hizmeti telefon kaydı desteklemez.'
  ],['Provision a phone-registration-capable SIP account and public number. Initially, route incoming calls to that registered account.','Obtain the registrar, username, password, optional outbound proxy and media requirements from the operator. Not every SIP trunk service accepts phone registration.']);
  const operatorPhoneDevice=()=>card('IP telefon → Account / SIP hesabı','IP phone → Account / SIP account',[
    'SIP Server / Registrar: operator.example.invalid yerine gerçek operatör adresi. Username / Auth ID ve Password: operatörün verdiği telefon hesabı.',
    'Kayıt süresi ve NAT/keepalive ayarlarını operatörün tarifine göre yapın. Telefon Verasist’e değil operatöre kayıtlı kalır.'
  ],['SIP Server / Registrar: replace operator.example.invalid with the actual operator address. Username / Auth ID and Password: the operator phone account.','Set registration expiry and NAT/keepalive according to the operator instructions. The phone remains registered with the operator, not with Verasist.']);
  const operatorVera=()=>card('Operatör paneli / desteği → Ana numara gelen yönü','Operator portal / support → Main-number inbound route',[
    'Ana numaranın gelen hedefini verilen Verasist SIP ağ geçidine/trunk’ına yönlendirin; gönderilecek DID rakamlarını teyit edin.',
    'Telefonun mevcut office-a-201 kaydını koruyun. Verasist trunk’ı için ayrı sağlanan kimlik/IP eşleşmesini kullanın; telefon hesabını kopyalayıp aynı hesabın REGISTER kaydını değiştirmeyin.'
  ],['Route the main number to the assigned Verasist SIP gateway/trunk and confirm the called DID digits that will be sent.','Keep the existing office-a-201 phone registration. Use the separately assigned trunk identity/IP peering for Verasist, rather than replacing the phone account registration.']);
  const staffRoute=()=>card('Operatör paneli / desteği → Personel numarası / SIP hedefi','Operator portal / support → Staff number / SIP destination',[
    'İkinci fiziksel IP telefon 202’de SIP Server olarak operatörü, ayrı kullanıcı/parola olarak office-a-202 hesabını tanımlayın ve REGISTER kaydını doğrulayın. Ayrı personel hedefini bu hesaba bağlayın. Örnekte 12025550201 personel hedefidir; 12025550101 ana numara Verasist’e gider.',
    'Verasist’ten bu hedefe giden aramaya izin verin. Böyle ayrı bir hedef/rota desteklenmiyorsa bu modelde personele dönüş kurulamaz; ana numaraya geri aramak döngü oluşturur.'
  ],['On a different physical IP phone 202, configure the operator SIP server and separate office-a-202 credentials; verify registration and route the separate staff number to this account. In the example, staff target 12025550201 reaches the phone while main number 12025550101 goes to Verasist.','Allow Verasist to call that destination. Without a separate supported destination/route, this return transfer cannot be established; calling the main number again creates a loop.']);
  const network=()=>card('Ağ yöneticisi → Firewall / NAT / Medya erişimi','Network administrator → Firewall / NAT / Media reachability',[
    'Verilen SIP sinyalleşme ve çift yönlü RTP adres/portlarına erişim sağlayın; SDP’de ilan edilen adreslerin ulaşılabilirliğini kontrol edin.',
    'Standart Verasist ağ geçidi UDP 5060 ve RTP UDP 10000–10099 kullanır; hizmetinize verilen değerler önceliklidir. Telefon/santral/operatör tarafının medya aralığı farklı olabilir.'
  ],['Allow the assigned SIP signaling and bidirectional RTP addresses/ports, and verify that the media addresses advertised in SDP are reachable.','The standard Verasist gateway uses UDP 5060 and RTP UDP 10000–10099; use your service’s assigned values. Phone, PBX and operator media ranges may differ.']);
  const automatic=()=>result([card('Çağrı sırasında → SIP uçları / çağrı motoru','During the call → SIP endpoints / call engine',[
    'Bu adım için yeni bir panel ayarı girilmez. Önceki adımlardaki hesap, trunk, numara ve rota tanımları kullanılır.',
    'SIP yanıtları, ACK, ses paketleri veya kapanış işlemleri uçlar tarafından otomatik yürütülür; paket içeriğini elle göndermeniz gerekmez.'
  ],['No new panel setting is entered for this step. It uses the accounts, trunks, numbers and routes prepared earlier.','Endpoints automatically handle SIP replies, ACK, audio packets and termination. The packet shown is not something to send manually.'])],'automatic');

  if(id==='public-line') {
    const forwarding=()=>card('A operatörü / Hat ayarları → Tüm aramaları yönlendir','Carrier A / Line settings → Forward all calls',[
      'Ana +12025550101 numarasını B’deki +12025550301 numarasına koşulsuz yönlendirin. Sabit hat için operatör aktivasyonu, mobilde hat/uygulama ayarı gerekebilir; kullanılan hattın talimatlarını izleyin.',
      'Hedef numara türüne izin, yönlendirme bedeli, eşzamanlı çağrı sınırı ve arayan kimliği aktarımını kontrol edin. Yalnız cevapsız/meşgul yönlendirmesi ilk karşılamayı her zaman YZ’nin yapmasını sağlamaz.'
    ],['Enable unconditional forwarding from main +12025550101 to +12025550301 at B. Landlines may require carrier activation; mobile lines may use line/app settings. Follow the instructions for the exact line.','Verify destination eligibility, forwarding charges, concurrent-call limits and caller-ID propagation. No-answer or busy-only forwarding does not guarantee AI reception first.']);
    const staff=()=>card('Verasist → İş akışı → Call Transfer / Personel hattı','Verasist → Workflow → Call Transfer / Staff line',[
      '+12025550201 ayrı personel numarasını izinli hedefe ekleyin; B operatörünün SIP bağlantısını giden bağlantı seçin. Bu numara mobil veya ana hattan ayrı sabit hat olabilir.',
      'Personel numarasından Verasist’e geri yönlendirme açmayın. Ana +12025550101 numarasını aktarım hedefi yapmayın; tek yönlendirilmiş numara varsa yalnız YZ karşılaması mümkündür.',
      'B’de dış arama izni, geçerli arayan kimliği ve iki bacak kapasitesini doğrulayın. Meşgul/cevapsız durumda müşteriyi bağlanmış saymayın; geri dönüş/alternatif hedef davranışını akışta belirleyin.'
    ],['Allow separate staff number +12025550201 in Call Transfer and select the carrier B SIP configuration for outbound calls. This may be a mobile or a landline separate from the main line.','Do not forward the staff number back to Verasist or use main +12025550101 as a transfer target. With only the single forwarded number, AI reception is possible but this staff return is not.','At B, verify outbound permission, authorized caller ID and capacity for two legs. For busy/no-answer, do not treat staff as connected; configure a fallback or alternate destination in the workflow.']);
    if(phase.key==='line-before') return result([card('Kurum telefonu → Mevcut operatör hattı','Office handset → Existing carrier line',[
      scenario.lineType==='fixed'?'Analog telefonu operatörün hat sonlandırmasına / TEL-FXS çıkışına RJ11 ile bağlayın. Kurumda SIP hesabı, IP telefon, ATA veya santral kurmayın.':'Mevcut mobil SIM/eSIM hattının normal arama alabildiğini kontrol edin; telefona SIP/Verasist hesabı tanımlanmaz.'
    ],[scenario.lineType==='fixed'?'Connect the analog handset to the carrier line termination / TEL-FXS port with RJ11. No office SIP account, IP phone, ATA or PBX is needed.':'Verify that the existing mobile SIM/eSIM line receives ordinary calls. No SIP/Verasist account is provisioned on the mobile.'])]);
    if(phase.key==='line-provision') return result([trunk('operator'),number(),network(),card('B operatörü → Verasist numarası / SIP teslimi','Carrier B → Verasist number / SIP delivery',['+12025550301 numarasını verilen Verasist SIP adresine teslim ettirin. Verasist’teki SIP Gateway IP/Port ve yetkilendirme bilgileri B’ye aittir; A’nın ana hat hesabını kullanmayın.'],['Have +12025550301 delivered to the assigned Verasist SIP address. Verasist SIP Gateway IP/Port and authentication belong to B; do not use the main-line account at A.'])]);
    if(['line-forward','line-network'].includes(phase.key)) return result([forwarding()]);
    if(['line-agent','line-greeting'].includes(phase.key)) return result([number(),agent()]);
    if(['line-staff','line-dial','line-staff-network','line-ring'].includes(phase.key)) return result([staff()]);
    if(phase.key==='line-bridge') return result([network(),card('Verasist servis yöneticisi → İki çağrıyı köprüle','Verasist service administrator → Bridge both calls',['Yalnız iki cevaplanmış bacağı Verasist üzerinde birleştirin; direct media ile medyayı Verasist dışına taşımayın. YZ’nin sesi aktarım sonrası durmalıdır.'],['Join only answered customer and staff legs at Verasist; prevent direct media from bypassing it. Stop AI speech after transfer.'])],'admin');
    return automatic();
  }
  if(scenario.pbxMode==='sip-number') {
    const staffDid={201:'+12025550201',202:'+12025550202',301:'+12025550311'}[target]||'+12025550201';

    const staff=()=>card('Operatör + kurum santrali → Ayrı personel DID rotası','Carrier + office PBX → Separate staff DID route',[
      `${staffDid} personel numarasını kurum santraline; santralde bu DID’yi ${target} hedefine yönlendirin. Dönüş DID’sinde Verasist’e yönlendirme kapalı olmalıdır. Ana +12025550101 numarasını tekrar aramayın.`,
      'Verasist Call Transfer hedefini ayrı personel numarası ve operatör SIP bağlantısı olarak tanımlayın. Giden arama, arayan kimliği ve eşzamanlı iki çağrı kapasitesini teyit edin.'
    ],[`Route staff number ${staffDid} to the office PBX and map that DID to ${target}. Never dial main number +12025550101 again.`,'Set Verasist Call Transfer to the separate staff number using the carrier SIP connection. Verify outbound permissions, caller ID and capacity for two concurrent calls.']);
    if(['number-trunk','number-forward-config','number-forward-lookup','number-forward'].includes(phase.key)) return result([trunk('operator'),network(),card('Operatör A → Ana numara yönlendirme; B → SIP teslimi','Carrier A → Main number forwarding; B → SIP delivery',['A’da mevcut +12025550101 numarasını +12025550301 Verasist numarasına koşulsuz yönlendirin. B’de +12025550301 için Verasist SIP teslimini yapılandırın. Haricî SIP teslimi, kaynak IP’ler, RTP aralığı ve codec uyumunu operatörle teyit edin; her hizmet bunu desteklemez.'],['At A forward existing +12025550101 to Verasist DID +12025550301 unconditionally. At B configure SIP delivery for +12025550301 to Verasist. Confirm external SIP delivery, source IPs, RTP ports and codec compatibility with the carrier; support is service-specific.'])]);
    if(phase.key==='number-agent') return result([number(),agent()]);
    if(['number-staff','number-dial-staff','number-office'].includes(phase.key)) return result([staff()]);
    if(['number-extension','number-analog-ring'].includes(phase.key)) return result([staff(),phone()]);
    if(phase.key==='number-greeting') return result([agent()]);
    if(phase.key==='number-bridge') return result([network(),card('Verasist servis yöneticisi → Medya köprüleme','Verasist service administrator → Media bridging',['Cevaplanmış iki bacağı Verasist’te köprüleyin; direct media ile sesi Verasist dışına taşımayın. YZ sesi aktarım sonrası durmalıdır.'],['Bridge both answered legs at Verasist, preventing direct media from bypassing it. Stop AI speech after transfer.'])],'admin');
    return automatic();
  }
  if(id==='direct' && scenario.directMode==='forward' && phase.key) {
    if(phase.key==='forward-setup') return result([trunk('operator'),number(),card('B operatörü → Verasist numarasının SIP rotası','Carrier B → SIP route for the Verasist number',['B’den ayrı Verasist numarası alın; gelen SIP hedefini Verasist’in verilen ağ geçidine ayarlayın. Verasist SIP Gateway IP/Port ve hesap bilgileri B’ye aittir; A operatörünün telefon hesabını kullanmayın.'],['Provision a separate Verasist number at B and route it to the assigned Verasist gateway. Verasist SIP Gateway IP/Port and credentials belong to B; do not use the phone credentials from A.'])]);
    if(phase.key==='forward-route') return result([card('A operatörü → Numara yönlendirme / destek','Carrier A → Number forwarding / support',['Ana numara 12025550101 için hedefi B’deki 12025550301 numarası olarak tanımlayın. Koşulsuz yönlendirme etkin olmalı; yalnızca cevapsız yönlendirme ilk karşılamayı garanti etmez.','Hat/paket uygunluğu, yönlendirme ücreti ve arayan kimliğini teyit edin. Bu alan SIP Gateway IP veya registrar değildir.'],['For main number 12025550101, set forwarding destination to number 12025550301 at B. Use unconditional forwarding; no-answer forwarding does not guarantee AI reception first.','Confirm line/plan eligibility, forwarding charges and caller-ID propagation. This is not a SIP Gateway IP or registrar field.'])]);
    if(['forward-staff','forward-dial','forward-staff-network','forward-ring'].includes(phase.key)) return result([card('A operatörü + IP telefon → Ayrı personel hattı','Carrier A + IP phone → Separate staff line',['İkinci fiziksel IP telefon 202’yi ayrı office-a-202 hesabıyla A’ya kaydedin; 12025550201 personel numarasını bu hesaba bağlayın ve bu hatta ana numaranın yönlendirmesini uygulamayın. Gerekirse ikinci hat açılması ve telefon hesabının yeniden sağlanması gerekir.','A’da ayrı ulaşılabilir personel hattı mümkün değilse bu şema uygulanamaz; personel GSM, WebRTC veya ikinci SIP hesabı alternatifleri ayrıca kurulmalıdır.'],['Register a different physical IP phone 202 at A with account office-a-202 and route staff number 12025550201 to it without main-number forwarding. This may require a second line and reprovisioning the phone account.','If A cannot provide a separate reachable staff line, this diagram cannot be used; mobile, WebRTC or a second SIP account require a separate setup.']),card('Verasist → Call Transfer → Giden bağlantı B','Verasist → Call Transfer → Outbound connection B',['Hedef olarak 12025550201 personel numarasını ve B’nin SIP yapılandırmasını seçin. Yönlenen ana numarayı hedef yapmayın; iki çağrı bacağına yetecek kapasiteyi kontrol edin.'],['Select staff number 12025550201 and the SIP configuration for B. Do not use the forwarded main number; verify capacity for both call legs.'])]);
    if(phase.key==='forward-invite') return result([number()]);
    if(phase.key==='forward-greet') return result([agent()]);
    if(phase.key==='forward-bridge') return result([network(),card('Verasist servis yöneticisi → Medyayı köprüde tut','Verasist service administrator → Keep media in the bridge',['İki cevaplanmış çağrı kanalını Verasist’te köprüleyin; direct media ile medyanın dışarı taşınmaması gerekir. Operatörler arası erişim şematik, SIP tarafındaki ses RTP’dir.'],['Bridge both answered call channels inside Verasist and prevent direct media from bypassing it. Inter-carrier access is schematic; audio on SIP legs uses RTP.'])],'admin');
    return automatic();
  }
  if(id==='direct') {
    if(title==='Önce yalnızca operatör ve IP telefon var') return result([operatorPhone(),operatorPhoneDevice()]);
    if(['Telefona operatör hesabı girilir','IP telefon operatöre REGISTER gönderir'].includes(title)) return result([operatorPhoneDevice()]);
    if(title==='Müşteri dış numarayı arar') return result([operatorPhone()]);
    if(title==='Şimdi Verasist operatör bağlantısına eklenir') return result([operatorVera(),trunk('operator'),number()]);
    if(title==='Telefona ayrı bir dönüş hedefi tanımlanır') return result([staffRoute(),transfer(true)]);
    if(['Yeni müşteri çağrısı operatöre gelir','Operatör yeni çağrıyı Verasist’e verir'].includes(title)) return result([operatorVera(),number()]);
    if(title==='İlk karşılamayı artık Verasist yapar') return result([agent()]);
    if(title==='Verasist ayrı personel hedefini arar') return result([transfer(true),staffRoute()]);
    if(title==='Operatör kayıtlı IP telefonu çaldırır') return result([staffRoute()]);
    if(title==='Müşteri ve personel Verasist üzerinden konuşur') return result([network()]);
    return automatic();
  }
  if(id==='registration') {
    if(scenario.registrationMode==='phones') {
      if(title==='Önce kurumun sanal santrali hazırlanır') return result([card('Kurum sanal santrali → Dahililer / Endpoint–Auth–AOR','Office virtual PBX → Extensions / Endpoint–Auth–AOR',['IP telefonlar için 201 ve 202 hesaplarını ayrı parolalarla açın. Analog telefon için 301 hesabını ATA’nın FXS portuyla eşleyin.','Bu hesapları bu örnekte kurum santrali sağlar; mevcut Verasist SIP Trunk formu masa telefonu hesabı oluşturmaz.'],['Create phone accounts 201 and 202 with separate credentials. Map account 301 to the ATA FXS port for an analog phone.','In this example the office PBX provides these accounts; the current Verasist SIP Trunk form does not provision desk-phone accounts.']),phone()]);
      if(title==='Diğer telefonlar da ayrı kaydolur') return result([card('IP telefon 202 + ATA 301 → SIP hesabı','IP phone 202 + ATA 301 → SIP account',['202 telefonunda SIP Server olarak kurum santralini, kullanıcı adı/parola olarak 202 hesabını girin. ATA’da aynı sunucuya 301 hesabını tanımlayıp ilgili FXS portuna bağlayın.'],['On phone 202, set SIP Server to the office PBX and use account 202 credentials. On the ATA, register account 301 to the same server and map it to the appropriate FXS port.'])]);
      if(title==='Telefon kayıt isteğini gönderir') return result([phone()]);
      if(title==='Süre dolmadan kayıt yenilenir') return result([network()]);
      if(title==='Santral Verasist’e ayrı bağlanır') return result([pbxToVera(),trunk('pbx'),number()]);
    } else {
      if(title==='Mevcut santral ve trunk hesabı hazırlanır') return result([card('Kurum santrali → Verasist’e özel trunk hesabı','Office PBX → Dedicated Verasist trunk account',['Bu örnekte santral registrar’dır. Verasist’ten gelen REGISTER’ı kabul eden ayrı trunk hesabı, parola ve arama yetkileri oluşturun.','Tek cihaz kısıtlı masa telefonu hesabı yerine gerekli eş zamanlı çağrıları destekleyen trunk hesabı kullanın.'],['In this example the PBX is the registrar. Create a separate trunk account, password and calling permissions for registrations from Verasist.','Use a trunk account that supports the required concurrent legs, rather than a single-device desk-phone account.']),trunk('pbx')]);
      if(title==='Verasist santrale kayıt isteği gönderir') return result([card('Verasist → SIP Trunk → Enable Registration','Verasist → SIP Trunk → Enable Registration',['Bu kayıtlı hesap örneğinde true seçin. SIP Gateway IP/Port santrali; Username/Password santralde açılan trunk hesabını gösterir.','REGISTER yönü Verasist → santraldir; bu seçenek santralin Verasist’e kaydını kurmaz.'],['Select true for this registered-account example. SIP Gateway IP/Port identify the PBX; Username/Password are the trunk account created on it.','REGISTER goes Verasist → PBX. This setting does not configure PBX registration into Verasist.'])]);
      if(title==='Gelen çağrı eşleşmesi ayrıca ayarlanır') return result([trunk('pbx'),number(),network()]);
      if(title==='REGISTER her trunk için zorunlu değildir') return result([card('Santral + Verasist → IP eşleşmeli trunk','PBX + Verasist → IP-peered trunk',['Karşılıklı izinli sinyalleşme adreslerini ve rotaları tanımlayın; Enable Registration false olur.','Mevcut formun zorunlu Username/Password alanlarına kurulum için verilen bilgileri girin. Dinamik IP/CGNAT için gerekirse erişilebilir VPN/SBC yolu gerekir.'],['Configure allowed peer signaling addresses and routes; set Enable Registration to false.','Fill the current form’s required Username/Password fields with the assigned setup credentials. Dynamic IP/CGNAT may need a reachable VPN/SBC path.'])]);
    }
    return automatic();
  }
  if(title==='Müşteri kurumun numarasını arar') return result([card('Operatör paneli / desteği → DID yönlendirmesi','Operator portal / support → DID routing',['Kurum numarasını santralin erişilebilir SIP bağlantısına yönlendirin; operatör trunk’ının kayıt/IP modelini operatörle belirleyin.'],['Route the public office number to the reachable PBX SIP connection and agree the operator trunk registration/IP-peering model.']),pbx()]);
  if(title==='Operatör çağrıyı santrale getirir') return result([pbx()]);
  if(/^\d+ aranıyor$/.test(title) || title==='ATA analog telefonu çaldırır') return result([phone(),pbx()]);
  if(id==='reception') {
    if(title==='Santral IVR yerine Verasist’i seçer') return result([pbxToVera(),trunk('pbx'),number()]);
    if(title==='YZ ilk karşılamayı yapar') return result([agent()]);
    if(title==='YZ aktarım kararını verir') return result([transfer(),pbxToVera()]);
    if(title==='Müşteri ve personel konuşuyor') return result([network()]);
  }
  if(id==='extension') {
    if(title==='Personel 700’e aktarım ister') return result([virtual700(),card('IP telefon → Transfer tuşu / aktarım yöntemi','IP phone → Transfer key / transfer method',['Görüşme sırasında Transfer tuşuyla 700 hedefini seçin. Bu örnek REFER destekli telefon/santral kullanır; marka ve özellik kodu farklı olabilir.'],['During the call, use Transfer and select 700. This example uses a REFER-capable phone/PBX; vendor feature codes and transfer methods may differ.'])],'action');
    if(title==='700 hedefi Verasist’e yönlendirilir') return result([virtual700(),trunk('pbx'),number()]);
    if(title==='700 numaralı YZ müşteriyle konuşur') return result([agent()]);
  }
  if(id==='pbx' && title==='Müşteri ve personel konuşuyor') return result([card('Ağ yöneticisi + santral → NAT / RTP','Network administrator + PBX → NAT / RTP',['Santral ve telefonların SDP adresleri ile çift yönlü RTP erişimini doğrulayın. Medya bu örnekte santral üzerinden geçer; doğrudan medya tercihleri santralde yönetilir.'],['Verify PBX/phone SDP addresses and bidirectional RTP reachability. Media passes through the PBX in this example; direct-media preferences are managed on the PBX.'])]);
  return automatic();
}
