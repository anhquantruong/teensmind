const LOCATIONS_API = 'https://provinces.open-api.vn/api/v2/?depth=2';
  const SCOPE_PROVINCE_MATCH = ['Hồ Chí Minh', 'Đồng Nai']; 
  const PROVINCE_EN_NAMES = {
    'Hồ Chí Minh': 'Ho Chi Minh City',
    'Đồng Nai': 'Dong Nai City',
  };
  function wardEnGuess(viName){
    if(viName.startsWith('Phường ')) return viName.replace('Phường ', '') + ' Ward';
    if(viName.startsWith('Xã ')) return viName.replace('Xã ', '') + ' Commune';
    if(viName.startsWith('Đặc khu ')) return viName.replace('Đặc khu ', '') + ' Special Zone';
    return viName;
  }

  const locationsState = { status:'idle', provinces:[] }; 

  async function ensureLocationsLoaded(onChange){
    if(locationsState.status === 'loading' || locationsState.status === 'ready') return;
    locationsState.status = 'loading';
    try{
      const res = await fetch(LOCATIONS_API);
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      locationsState.provinces = data
        .filter(p => SCOPE_PROVINCE_MATCH.some(name => p.name.includes(name)))
        .map(p => {
          const matchKey = SCOPE_PROVINCE_MATCH.find(name => p.name.includes(name));
          return {
            vi: p.name,
            en: PROVINCE_EN_NAMES[matchKey] || p.name,
            wards: (p.wards || []).map(w => ({ vi: w.name, en: wardEnGuess(w.name) })),
          };
        });
      locationsState.status = 'ready';
    } catch(err){
      console.error('Không tải được danh sách phường:', err);
      locationsState.status = 'error';
    }
    onChange();
  }

  const steps = [
    { key:'lang', type:'lang' },
    { key:'q1', type:'single', required:true,
      q:{vi:'Bạn đang cần dịch vụ tham vấn tâm lý cho ai?', en:'Who do you need psychological counseling services for?'},
      options:[
        {vi:'Bản thân', en:'Myself'},
        {vi:'Cho người thân', en:'For a loved one'},
      ]},

    { key:'q1a', type:'single', required:true,
      showIf:a => a.q1 === 1,
      q:{vi:'Mối quan hệ của bạn và người cần tham vấn là gì?', en:"What is your relationship to the person who needs counseling?"},
      options:[
        {vi:'Cha mẹ', en:'Parents'},
        {vi:'Vợ/Chồng', en:'Spouses'},
        {vi:'Cặp đôi', en:'Couple'},
        {vi:'Con cái', en:'Children'},
        {vi:'Người thân', en:'Relatives'},
        {vi:'Others', en:'Others'},
      ]},

    { key:'q2', type:'text', required:true, inputType:'number',
        q:{vi:'Người cần tham vấn đang ở độ tuổi nào?', en:'What age group is the person who needs counseling in?'},
        hint: {vi: 'Nhập tuổi người cần tham vấn.', en: "Please enter the age of the person who needs counseling service."},
        placeholder: {vi:'Ví dụ: 25', en:'e.g. 25'},
      },

        { key:'q3', type:'single', required: false,
      q:{vi:'Giới tính của người cần tham vấn là gì?', en:'What is the gender of the person who needs counseling?'},
      hint:{vi:'Không bắt buộc trả lời.', en:'Optional. You can skip this question!'},
      options:[
        {vi:'Nam', en:'Male'},
        {vi:'Nữ', en:'Female'},
        {vi:'Phi nhị giới (Non-binary)', en:'Non-binary'},
        {vi:'Khác', en:'Other'},
        {vi:'Không muốn tiết lộ', en:'Prefer not to say'},
      ]},

    { key:'q4perm', type:'single', required:true,
      q:{vi:'Bạn có đồng ý cho PsyMapVN truy cập vị trí của bạn không?', en:'Do you agree to let PsyMapVN access your location?'},
      hint:{vi:'Giúp chúng mình gợi ý cơ sở gần bạn nhất. Vị trí không được lưu trữ sau phiên sàng lọc.', en:"This helps us suggest facilities closest to you. Your location isn't stored after this session."},
      options:[
        {vi:'Đồng ý', en:'Agree'},
        {vi:'Không đồng ý', en:'Disagree'},
      ]},

    { key:'q4', type:'cascade', required:true,
      showIf:a => a.q4perm === 1 || a.q4geoDenied === true,
      q:{vi:'Bạn đang sinh sống tại địa phương nào?', en:'Where do you currently live now?'},
      hint:{vi:'Chọn Tỉnh/Thành trước, sau đó chọn Phường.', en:'Select a Province/City first, then a Ward.'}},

    { key:'q5', type:'multi', required:false, grid:true,
  q:{vi:'Bạn có thuộc nhóm hỗ trợ nào sau đây không?', en:'Do you belong to any of the following support groups?'},
  hint:{vi:'Không bắt buộc trả lời. Có thể chọn nhiều đáp án.', en:'Optional. You can select more than one.'},
  options:[
    {vi:'Nhân viên Y tế', en:'Healthcare workers'},
    {vi:'Người bệnh mạn tính', en:'People with chronic illness'},
    {vi:'Người có H', en:'People living with HIV'},
    {vi:'Cộng đồng LGBTQ+', en:'LGBTQ+ community'},
    {vi:'Nạn nhân buôn bán người', en:'Human trafficking survivors'},
    {vi:'Nạn nhân của bạo lực', en:'Survivors of violence'},
  ]},

    { key:'q6', type:'single', required:true,
      q:{vi:'Bạn có đang có ý nghĩ/kế hoạch tự làm hại bản thân, tự tử, hoặc hành vi gây nguy hiểm nghiêm trọng cho người khác không?',
         en:'Are you having thoughts/plans of self-harm or suicide, or behaving in a way that seriously endangers others?'},
      hint:{vi:'Câu trả lời hoàn toàn bảo mật. Nếu bạn đang gặp nguy hiểm, chúng mình sẽ ưu tiên đưa bạn đến hỗ trợ khẩn cấp trước.',
            en:'Your answer is confidential. If you are in danger, we will prioritize connecting you to emergency support first.'},
      options:[
        {vi:'Có', en:'Yes'},
        {vi:'Không', en:'No'},
      ]},

    { key:'q7', type:'single', required:true,
      showIf:a => a.q6 !== 0,
      q:{vi:'Các biểu hiện bất ổn (cảm xúc, suy nghĩ, hành vi) của bạn đã kéo dài bao lâu?',
         en:'How long have your emotional, cognitive, or behavioral difficulties lasted?'},
      options:[
        {vi:'Dưới 2 tuần', en:'Less than 2 weeks'},
        {vi:'Trên 2 tuần', en:'More than 2 weeks'},
      ]},

    { key:'q8', type:'multi', required:false, grid:true,
      showIf:a => a.q6 !== 0,
      q:{vi:'Bạn có đang gặp dấu hiệu nào sau đây không?', en:'Are you experiencing any of the following?'},
      hint:{vi:'Có thể chọn nhiều đáp án. Không bắt buộc.', en:'You can select more than one. Optional.'},
      options:[
        {vi:'Cảm thấy buồn rầu hoặc thu mình', en:'Feeling sad or withdrawn'},
        {vi:'Cơn hoảng loạn không rõ nguyên nhân (tim đập nhanh, khó thở)', en:'Unexplained panic attacks (rapid heartbeat, shortness of breath)'},
        {vi:'Lo lắng/sợ hãi dữ dội ảnh hưởng sinh hoạt hàng ngày', en:'Intense anxiety/fear affecting daily activities'},
        {vi:'Rất khó tập trung hoặc ngồi yên một chỗ', en:'Great difficulty concentrating or sitting still'},
        {vi:'Hành vi ăn uống không lành mạnh (ăn quá nhiều/quá ít/tập luyện quá sức)', en:'Unhealthy eating behaviors (binge/restrict/excessive exercise)'},
        {vi:'Sử dụng chất kích thích hoặc rượu bia', en:'Substance or alcohol use'},
        {vi:'Thay đổi tâm trạng nghiêm trọng ảnh hưởng quan hệ gia đình/bạn bè', en:'Severe mood changes affecting relationships with family/friends'},
      ]},

    { key:'q9', type:'single', required:true,
      showIf:a => a.q6 !== 0,
      q:{vi:'Những biểu hiện này có đang cản trở việc học tập, công việc hoặc sinh hoạt hằng ngày của bạn không?',
         en:'Are these difficulties interfering with your study, work, or daily life?'},
      options:[
        {vi:'Không', en:'Not at all'},
        {vi:'Có, một ít', en:'A little'},
        {vi:'Có, nhiều', en:'A lot'},
      ]},

    { key:'q10', type:'single', required:true,
      showIf:a => a.q6 !== 0,
      q:{vi:'Bạn có muốn dùng thuốc để cải thiện tình trạng hiện tại không? Ví dụ: mất ngủ kéo dài, mệt mỏi kéo dài, khó kiểm soát hành vi/cảm xúc.',
         en:'Do you want to use medication to improve your current state? E.g. persistent insomnia, prolonged fatigue, difficulty controlling emotions/behavior.'},
      options:[
        {vi:'Có', en:'Yes'},
        {vi:'Không', en:'No'},
        {vi:'Chưa chắc', en:'Not sure'},
      ]},

    { key:'q11', type:'single', required:true,
      showIf:a => a.q6 !== 0,
      q:{vi:'Bạn vẫn duy trì tốt các chức năng sống cơ bản (ăn, ngủ, làm việc, giao tiếp) nhưng chưa tìm được cách ứng phó lành mạnh với vấn đề của mình?',
         en:'Are you still functioning well overall (eating, sleeping, working, socializing) but haven\'t found a healthy way to cope with your issue?'},
      options:[
        {vi:'Đúng', en:'Yes, that\'s me'},
        {vi:'Không đúng', en:'No, not really'},
      ]},

    { key:'q12', type:'single', required:true,
      showIf:a => a.q6 !== 0,
      q:{vi:'Vấn đề chính của bạn có liên quan nhiều đến mối quan hệ (gia đình, xã hội, tình cảm) hơn là triệu chứng cơ thể/tinh thần rõ rệt không?',
         en:'Is your main concern more about relationships (family, social, romantic) than clear physical/mental symptoms?'},
      options:[
        {vi:'Có', en:'Yes'},
        {vi:'Không', en:'No'},
      ]},

      { key:'done', type:'done' },
  ];

  function computeRecommendation(a) {
    if (a.q6 === 0) {
      return { redFlag: true, recommendation: 'emergency' };
    }

    const soDauHieu = Array.isArray(a.q8) ? a.q8.length : 0;
    const thoiGianDai = a.q7 === 1;
    const anhHuongChucNang = a.q9;
    const muonDungThuoc = a.q10 === 0;
    const chucNangOnDinh = a.q11 === 0;
    const vanDeMoiQuanHe = a.q12 === 0;

    const nghieng_bac_si = muonDungThuoc || anhHuongChucNang === 2 || (thoiGianDai && soDauHieu >= 3);
    const nghieng_tam_ly = chucNangOnDinh && vanDeMoiQuanHe;

    let recommendation;
    if (nghieng_bac_si && !nghieng_tam_ly) recommendation = 'psychiatrist';
    else if (nghieng_tam_ly && !nghieng_bac_si) recommendation = 'psychologist';
    else recommendation = 'ambiguous';

    return {
      redFlag: false,
      recommendation,
      soDauHieu,
      anhHuongChucNang,
      muonDungThuoc,
      chucNangOnDinh,
      vanDeMoiQuanHe,
    };
  }