(function () {
  'use strict';
  const STORAGE_KEY = 'mappingWizardResult';
  const CLINICS_API = '/api/clinics';
  const FORCE_MOCK = false;

  const NEAREST_RADIUS_KM = 5;  
  const WARD_FALLBACK_RADIUS_KM = 3; 

  const FALLBACK_CENTER = { lat: 10.7769, lng: 106.7009 };
  const PROVINCE_FALLBACK_CENTERS = {
    'Hồ Chí Minh': { lat: 10.7769, lng: 106.7009 },
    'Đồng Nai': { lat: 10.9574, lng: 106.8426 },
  };
  function fallbackForProvince(provinceVi) {
    const key = (provinceVi || '').toLowerCase();
    const match = Object.keys(PROVINCE_FALLBACK_CENTERS).find(k => key.includes(k));
    return match ? PROVINCE_FALLBACK_CENTERS[match] : FALLBACK_CENTER;
  }

  function matchesKnownProvince(name) {
    const key = (name || '').toLowerCase();
    return Object.keys(PROVINCE_FALLBACK_CENTERS).some(
      k => key.includes(k.toLowerCase()) || k.toLowerCase().includes(key)
    );
  }

  function guessProvinceByPoint(point) {
    if (!point) return null;
    let best = null;
    let bestDist = Infinity;
    for (const [name, center] of Object.entries(PROVINCE_FALLBACK_CENTERS)) {
      const d = haversineKm(point, { latitude: center.lat, longitude: center.lng });
      if (d != null && d < bestDist) {
        bestDist = d;
        best = name;
      }
    }
    return best;
  }

  const REQUIRED_STRING_FIELDS = [
    'phone',
    'website',
    'ggmaps_link',
    'ward',
    'prov',
    'address',
    'psychiatris_or_psychologist',
  ];

  function hasRequiredFields(clinic) {
    for (const key of REQUIRED_STRING_FIELDS) {
      const v = clinic[key];
      if (v == null || String(v).trim() === '') return false;
    }
    const lat = clinic.latitude;
    const lng = clinic.longitude;
    if (lat == null || lat === '' || Number.isNaN(Number(lat))) return false;
    if (lng == null || lng === '' || Number.isNaN(Number(lng))) return false;
    return true;
  }

  function isCombinedClinic(clinic) {
    const val = (clinic.psychiatris_or_psychologist || '').toLowerCase();
    return val.includes('psychiatrist') && val.includes('psychologist');
  }

  const SERVICE_OPTIONS = [
    { vi: 'Lo âu', en: 'Anxiety', kw: ['lo âu', 'anxiety'] },
    { vi: 'Trầm cảm', en: 'Depression', kw: ['trầm cảm', 'depression'] },
    { vi: 'Stress', en: 'Stress', kw: ['stress', 'căng thẳng'] },
    { vi: 'Kiệt sức', en: 'Burnout', kw: ['kiệt sức', 'burnout'] },
    { vi: 'Khủng hoảng', en: 'Crisis', kw: ['khủng hoảng', 'crisis'] },
    { vi: 'Mất ngủ', en: 'Insomnia', kw: ['mất ngủ', 'insomnia'] },
    { vi: 'Quan hệ gia đình', en: 'Family relationships', kw: ['gia đình', 'family'] },
    { vi: 'Quan hệ tình cảm', en: 'Romantic relationships', kw: ['tình cảm', 'relationship'] },
    { vi: 'Hôn nhân', en: 'Marriage', kw: ['hôn nhân', 'marriage'] },
    { vi: 'Nuôi dạy con', en: 'Parenting', kw: ['nuôi dạy con', 'parenting'] },
    { vi: 'Sang chấn', en: 'Trauma', kw: ['sang chấn', 'trauma'] },
    { vi: 'ADHD', en: 'ADHD', kw: ['adhd', 'tăng động'] },
    { vi: 'Phổ Tự kỷ', en: 'Autism Spectrum Disorder', kw: ['tự kỷ', 'autism'] },
    { vi: 'Rối loạn ăn uống', en: 'Eating disorders', kw: ['ăn uống', 'eating disorder'] },
    { vi: 'Nghiện', en: 'Addiction', kw: ['nghiện', 'addiction'] },
    { vi: 'Khó khăn trong học tập', en: 'Academic difficulties', kw: ['học tập', 'academic'] },
    { vi: 'Khó khăn trong công việc', en: 'Work difficulties', kw: ['công việc', 'work'] },
    { vi: 'Khác', en: 'Other', kw: [] },
  ];

  const SUPPORT_GROUP_OPTIONS = [
    { vi: 'Nhân viên Y tế', en: 'Healthcare workers' },
    { vi: 'Người bệnh mạn tính', en: 'People with chronic illness' },
    { vi: 'Người có H', en: 'People living with HIV' },
    { vi: 'Cộng đồng LGBTQ+', en: 'LGBTQ+ community' },
    { vi: 'Nạn nhân buôn bán người', en: 'Human trafficking survivors' },
    { vi: 'Nạn nhân của bạo lực', en: 'Survivors of violence' },
  ];

  const RELATIONSHIP_SERVICE_MAP = {
    0: ['Quan hệ gia đình', 'Nuôi dạy con'], 
    1: ['Hôn nhân'],                          
    2: ['Quan hệ tình cảm'],                 
    3: ['Nuôi dạy con', 'Quan hệ gia đình'],  
    4: ['Quan hệ gia đình'],                  
    5: [],                                    
  };

  const GEO_OPTIONS = [
    { key: 'nearest', vi: 'Gần nhất', en: 'Nearest' },
    { key: 'ward', vi: 'Trong phường', en: 'Same ward' },
    { key: 'province', vi: 'Trong tỉnh/thành', en: 'Same province' },
    { key: 'any', vi: 'Không quan trọng', en: "Doesn't matter" },
  ];

  const TREATMENT_OPTIONS = [
    { key: '', vi: 'Không quan trọng', en: "Doesn't matter" },
    { key: 'psychiatrist', vi: 'Sử dụng thuốc', en: 'With medication' },
    { key: 'psychologist', vi: 'Tâm lý trị liệu (Không sử dụng thuốc)', en: 'Clinical psychology (without medication' },
  ];

  const state = {
    lang: 'vi',
    answers: null,
    location: null,
    recommendation: null,
    refPoint: null,
    userWard: null,
    userProvince: null,
    clinics: [],
    matches: [],
    currentIndex: 0,
    map: null,
    markers: {},
    usingMock: false,
    filters: {
      geo: 'nearest',
      services: [],
      treatment: '',
      type: '',
    },
  };

  const $ = (id) => document.getElementById(id);

  function loadWizardData() {
    let raw;
    try {
      raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      raw = null;
    }
    if (!raw || !raw.answers) {
      showNoDataAndRedirect();
      return false;
    }
    state.answers = raw.answers;
    state.location = raw.location || {};
    state.recommendation = raw.recommendation || null;
    state.lang = document.body.getAttribute('data-lang') || 'vi';

    if (state.recommendation && !state.recommendation.redFlag &&
        (state.recommendation.recommendation === 'psychiatrist' ||
         state.recommendation.recommendation === 'psychologist')) {
      state.filters.treatment = state.recommendation.recommendation;
    }

    return true;
  }

  function showNoDataAndRedirect() {
    $('resultsLoading').classList.add('hidden');
    $('resultsEmpty').classList.remove('hidden');
    $('resultsEmpty').querySelector('h3').innerHTML =
      '<span lang-el="vi">Chưa có dữ liệu sàng lọc</span><span lang-el="en">No screening data found</span>';
    $('resultsEmpty').querySelector('p').innerHTML =
      '<span lang-el="vi">Đang đưa bạn về trang chủ để bắt đầu…</span><span lang-el="en">Redirecting you to the homepage to start…</span>';
    setTimeout(() => {
      if (typeof showPage === 'function') showPage('home');
      else window.location.href = 'index.html';
    }, 2500);
  }

  function showEmergencyState() {
    $('resultsLoading').classList.add('hidden');
    $('resultsCard').classList.add('hidden');
    const empty = $('resultsEmpty');
    empty.classList.remove('hidden');
    empty.querySelector('h3').innerHTML =
      '<span lang-el="vi">Bạn cần được hỗ trợ khẩn cấp</span><span lang-el="en">You need urgent support</span>';
    empty.querySelector('p').innerHTML =
      '<span lang-el="vi">Vui lòng liên hệ ngay đường dây nóng hoặc đến cơ sở cấp cứu gần nhất.</span>' +
      '<span lang-el="en">Please contact a crisis hotline or go to the nearest emergency facility right away.</span>';
  }

  function getReferencePoint() {
    return new Promise((resolve) => {
      if (state.location && state.location.type === 'geo' && state.location.coords) {
        resolve({ lat: state.location.coords.lat, lng: state.location.coords.lng, source: 'gps' });
        return;
      }
      geocodeSelectedWard().then(resolve);
    });
  }

  async function tryGeocode(query) {
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.lat != null && data.lng != null) {
          return { lat: parseFloat(data.lat), lng: parseFloat(data.lng) };
        }
        console.warn(`Không tìm thấy kết quả cho truy vấn "${query}" (backend geocode)`);
      } else {
        console.warn(`Geocode API trả về lỗi HTTP ${res.status} cho truy vấn "${query}" — thử Nominatim.`);
      }
    } catch (e) {
      console.warn(`Geocode nội bộ lỗi cho truy vấn "${query}", thử Nominatim:`, e);
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) {
        console.warn(`Nominatim trả về lỗi HTTP ${res.status} cho truy vấn "${query}"`);
        return null;
      }
      const results = await res.json();
      if (Array.isArray(results) && results.length && results[0].lat != null && results[0].lon != null) {
        return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
      }
      console.warn(`Không tìm thấy kết quả cho truy vấn "${query}" (Nominatim)`);
      return null;
    } catch (e) {
      console.warn(`Geocode lỗi cho truy vấn "${query}" (Nominatim):`, e);
      return null;
    }
  }

  async function geocodeSelectedWard() {
    const { wardVi, provinceVi } = state.location || {};
    if (!wardVi && !provinceVi) {
      console.warn('Không có wardVi/provinceVi trong state.location — dùng toạ độ mặc định.');
      return { ...FALLBACK_CENTER, source: 'fallback' };
    }

    if (wardVi && provinceVi) {
      const preciseResult = await tryGeocode([wardVi, provinceVi, 'Việt Nam'].filter(Boolean).join(', '));
      if (preciseResult) return { ...preciseResult, source: 'geocode' };
    }

    if (provinceVi) {
      const provinceResult = await tryGeocode([provinceVi, 'Việt Nam'].filter(Boolean).join(', '));
      if (provinceResult) return { ...provinceResult, source: 'geocode-province' };
    }
    console.warn(`Không geocode được "${wardVi || ''}, ${provinceVi || ''}" — dùng toạ độ mặc định của tỉnh/thành.`);
    return { ...fallbackForProvince(provinceVi), source: 'fallback' };
  }

  async function resolveUserLocationLabels() {
    if (state.location && state.location.type === 'manual') {
      state.userWard = state.location.wardVi || null;
      state.userProvince = state.location.provinceVi || null;
      return;
    }
    if (!state.refPoint) return;

    try {
      const res = await fetch(
        `/api/reverse-geocode?lat=${state.refPoint.lat}&lng=${state.refPoint.lng}`
      );
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      const data = await res.json();
      const addr = data.address || {};
      state.userWard = addr.suburb || addr.quarter || addr.city_district || addr.town || addr.village || null;
      state.userProvince = addr.city || addr.state || null;
    } catch (e) {
      console.warn('Reverse geocode thất bại — sẽ suy ra tỉnh/thành theo khoảng cách gần nhất:', e);
    }

    if (!state.userProvince || !matchesKnownProvince(state.userProvince)) {
      state.userProvince = guessProvinceByPoint(state.refPoint);
    }
  }

  async function loadClinics() {
    if (FORCE_MOCK) {
      state.usingMock = true;
      return typeof MOCK_CLINICS !== 'undefined' ? MOCK_CLINICS : [];
    }
    try {
      const res = await fetch(CLINICS_API);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Phản hồi /api/clinics không đúng định dạng mảng');
      state.usingMock = false;
      return data;
    } catch (e) {
      console.warn('Không gọi được /api/clinics, tạm dùng dữ liệu MẪU để test giao diện:', e);
      state.usingMock = true;
      return typeof MOCK_CLINICS !== 'undefined' ? MOCK_CLINICS : [];
    }
  }

  function haversineKm(a, b) {
    if (!a || !b || a.lat == null || b.latitude == null) return null;
    const R = 6371;
    const dLat = ((b.latitude - a.lat) * Math.PI) / 180;
    const dLng = ((b.longitude - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  const CLINIC_TYPE_MAP = {
    'bệnh viện công lập': 'public',
    'bệnh viện tư nhân': 'private',
    'phòng khám tư nhân': 'private',
    'tổ chức cộng đồng': 'community',
  };

  function normType(clinicType) {
    const t = (clinicType || '').trim().toLowerCase();
    if (CLINIC_TYPE_MAP[t]) return CLINIC_TYPE_MAP[t];
    if (t.includes('cộng đồng')) return 'community';
    if (t.includes('công lập')) return 'public';
    if (t.includes('tư nhân')) return 'private';
    return 'other';
  }

  function textIncludesAny(text, kwList) {
    const t = (text || '').toLowerCase();
    return kwList.some((kw) => kw && t.includes(kw));
  }

  function splitServices(serviceField) {
    return (serviceField || '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function ageMatches(clinic, age) {
    if (age == null || Number.isNaN(age)) return null;
    const min = clinic.min_age != null && clinic.min_age !== '' ? Number(clinic.min_age) : null;
    const max = clinic.max_age != null && clinic.max_age !== '' ? Number(clinic.max_age) : null;
    if (min != null && age < min) return false;
    if (max != null && age > max) return false;
    return true;
  }

  function evaluateClinic(clinic) {
    const a = state.answers;
    const age = a.q2 !== undefined && a.q2 !== '' ? Number(a.q2) : null;
    const ageOk = ageMatches(clinic, age);

    const relIdx = a.q1 === 1 ? a.q1a : undefined;
    const relatedServices = relIdx !== undefined ? (RELATIONSHIP_SERVICE_MAP[relIdx] || []) : [];
    const clinicServices = splitServices(clinic.service);

    const relationshipMatch = relatedServices.filter((label) => {
      const lower = label.toLowerCase();
      return (
        clinicServices.some((cs) => cs.toLowerCase() === lower) ||
        textIncludesAny(clinic.description, [lower]) ||
        textIncludesAny(clinic.target_groups, [lower])
      );
    });

    const selectedGroupLabels = Array.isArray(a.q5)
      ? a.q5.map((i) => SUPPORT_GROUP_OPTIONS[i]?.vi).filter(Boolean)
      : [];
    const clinicTargetGroups = splitServices(clinic.target_groups);
    const groupMatch = selectedGroupLabels.filter((label) =>
      clinicTargetGroups.some((tg) => tg.toLowerCase() === label.toLowerCase())
    );

    const verified = !!(clinic.license_number && String(clinic.license_number).trim());
    const combined = isCombinedClinic(clinic);

    return { ageOk, relationshipMatch, groupMatch, verified, combined, clinicServices, clinicTargetGroups };
  }

  function buildExplanation(clinic, m, distanceKm) {
    const vi = state.lang === 'vi';
    const parts = [];
    const name = clinic.clinic_name;

    if (m.verified) {
      parts.push(
        vi
          ? `${name} đã được cấp Giấy phép hoạt động chính thức (${clinic.license_number})`
          : `${name} holds an officially issued operating license (${clinic.license_number})`
      );
    } else {
      parts.push(name);
    }

    if (m.ageOk) {
      parts.push(vi ? `phù hợp với độ tuổi bạn cung cấp` : `fits the age you provided`);
    }

    if (m.relationshipMatch.length) {
      const names = m.relationshipMatch.map((s) => s.toLowerCase()).join(', ');
      parts.push(
        vi
          ? `có kinh nghiệm phù hợp với mối quan hệ bạn đang cần hỗ trợ: ${names}`
          : `has relevant experience for the relationship you need support for: ${names}`
      );
    }

    if (m.groupMatch.length) {
      const names = m.groupMatch.map((s) => s.toLowerCase()).join(', ');
      parts.push(
        vi
          ? `hỗ trợ nhóm đối tượng bạn thuộc về: ${names}`
          : `supports the group you belong to: ${names}`
      );
    }

    const selectedServices = state.filters.services;
    if (selectedServices.length) {
      const overlap = m.clinicServices.filter((cs) =>
        selectedServices.some((sel) => sel.toLowerCase() === cs.toLowerCase())
      );
      if (overlap.length) {
        parts.push(
          vi
            ? `cung cấp dịch vụ bạn đang tìm: ${overlap.join(', ').toLowerCase()}`
            : `offers the services you're looking for: ${overlap.join(', ').toLowerCase()}`
        );
      }
    }

    if (state.filters.treatment) {
      const wantsMed = state.filters.treatment === 'psychiatrist';
      parts.push(
        vi
          ? (wantsMed ? `có Khoa Tâm thần (có thể kê thuốc)` : `có dịch vụ Tâm lý lâm sàng (chữa trị không dùng thuốc)`)
          : (wantsMed ? `has psychiatrist (can prescribe medication)` : `provides clinical psychology servives  (non-medication)`)
      );
    }

    if (state.recommendation && state.recommendation.recommendation === 'ambiguous' && m.combined) {
      parts.push(
        vi
          ? `có cả Bác sĩ tâm thần và Nhà tâm lý làm việc theo ekip, phù hợp vì tình trạng của bạn cần đánh giá từ cả hai góc độ`
          : `has both a psychiatrist and a psychologist working as a team, fitting your situation`
      );
    }

    if (distanceKm != null) {
      parts.push(
        vi ? `cách bạn khoảng ${distanceKm.toFixed(1)} km` : `is about ${distanceKm.toFixed(1)} km from you`
      );
    }

    const sentence = parts.join(vi ? ', ' : ', ') + '.';
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }

  function computeMatches() {

    const eligibleClinics = state.clinics.filter(hasRequiredFields);

    const evaluated = eligibleClinics.map((c) => {
      const d = state.refPoint ? haversineKm(state.refPoint, c) : null;
      const e = evaluateClinic(c);
      return { clinic: c, distanceKm: d, ...e };
    });

    const ageFiltered = evaluated.filter((m) => m.ageOk !== false);

    const geoFiltered = ageFiltered.filter((m) => {
      switch (state.filters.geo) {
        case 'nearest':
          return m.distanceKm == null || m.distanceKm <= NEAREST_RADIUS_KM;
        case 'ward':
          if (state.userWard) return m.clinic.ward === state.userWard;
          return m.distanceKm == null || m.distanceKm <= WARD_FALLBACK_RADIUS_KM;
        case 'province':
          if (state.userProvince) {
            const prov = (m.clinic.prov || '');
            return prov.includes(state.userProvince) || state.userProvince.includes(prov);
          }
          return m.distanceKm == null || m.distanceKm <= NEAREST_RADIUS_KM;
        case 'any':
        default:
          return true;
      }
    });

    const serviceFiltered = state.filters.services.length
      ? geoFiltered.filter((m) =>
          m.clinicServices.some((cs) =>
            state.filters.services.some((sel) => sel.toLowerCase() === cs.toLowerCase())
          )
        )
      : geoFiltered;

    const treatmentFiltered = state.filters.treatment
      ? serviceFiltered.filter((m) => {
          const val = (m.clinic.psychiatris_or_psychologist || '').toLowerCase();
          return val.includes(state.filters.treatment);
        })
      : serviceFiltered;

    const typeFiltered = state.filters.type
      ? treatmentFiltered.filter(
          (m) => (m.clinic.clinic_type || '').trim() === state.filters.type
        )
      : treatmentFiltered;

    typeFiltered.sort((a, b) => {
      const ageA = a.ageOk ? 1 : 0;
      const ageB = b.ageOk ? 1 : 0;
      if (ageB !== ageA) return ageB - ageA;

      if (state.recommendation && state.recommendation.recommendation === 'ambiguous') {
        const combA = a.combined ? 1 : 0;
        const combB = b.combined ? 1 : 0;
        if (combB !== combA) return combB - combA;
      }

      const relA = a.relationshipMatch.length;
      const relB = b.relationshipMatch.length;
      if (relB !== relA) return relB - relA;

      const grpA = a.groupMatch.length;
      const grpB = b.groupMatch.length;
      if (grpB !== grpA) return grpB - grpA;

      const verA = a.verified ? 1 : 0;
      const verB = b.verified ? 1 : 0;
      if (verB !== verA) return verB - verA;

      const da = a.distanceKm == null ? Infinity : a.distanceKm;
      const db = b.distanceKm == null ? Infinity : b.distanceKm;
      return da - db;
    });

    state.matches = typeFiltered;
    state.currentIndex = 0;
  }

  function geoLabel() {
    const opt = GEO_OPTIONS.find((o) => o.key === state.filters.geo);
    return opt ? (state.lang === 'vi' ? opt.vi : opt.en) : '';
  }

  function renderHeader() {
    const vi = state.lang === 'vi';
    const n = state.matches.length;
    $('resultsHeadline').innerHTML = n
      ? (vi ? `Tìm thấy <b>${n}</b> cơ sở phù hợp với bạn` : `Found <b>${n}</b> facilities that fit you`)
      : (vi ? 'Không tìm thấy cơ sở phù hợp' : 'No matching facilities found');

    $('resultsSub').textContent = vi
      ? 'Vuốt qua từng gợi ý bên dưới hoặc xem trực tiếp vị trí trên bản đồ.'
      : 'Browse through each suggestion below or view its location on the map.';

    $('resultsCount').textContent = vi
      ? `${n} kết quả · ${geoLabel()}`
      : `${n} results · ${geoLabel()}`;

    const banner = $('mockBanner');
    if (banner) banner.classList.toggle('hidden', !state.usingMock);
  }

  function renderCard() {
    const loading = $('resultsLoading');
    const empty = $('resultsEmpty');
    const card = $('resultsCard');
    loading.classList.add('hidden');

    if (!state.matches.length) {
      empty.classList.remove('hidden');
      card.classList.add('hidden');
      $('resultsProgress').textContent = '0 / 0';
      $('prevClinic').disabled = true;
      $('nextClinic').disabled = true;
      return;
    }
    empty.classList.add('hidden');
    card.classList.remove('hidden');

    const vi = state.lang === 'vi';
    const m = state.matches[state.currentIndex];
    const c = m.clinic;
    const type = normType(c.clinic_type);

    const tag = $('rcTypeTag');
    tag.dataset.type = type;
    tag.textContent = c.clinic_type || (vi ? 'Không rõ' : 'Unknown');

    $('rcName').textContent = c.clinic_name || '—';
    $('rcVerifiedBadge').classList.toggle('hidden', !m.verified);

    $('rcAddress').textContent = c.address || c.old_address || '—';
    $('rcDistance').textContent =
      m.distanceKm != null
        ? (vi ? `Cách bạn ~ ${m.distanceKm.toFixed(1)} km` : `~ ${m.distanceKm.toFixed(1)} km away`)
        : (vi ? 'Không xác định được khoảng cách' : 'Distance unavailable');

    const directionsBtn = $('rcDirections');
    const hasDirectionsLink = !!(c.ggmaps_link && c.ggmaps_link.trim());
    directionsBtn.classList.toggle('hidden', !hasDirectionsLink);
    if (hasDirectionsLink) directionsBtn.href = c.ggmaps_link.trim();

    $('rcPhone').textContent = c.phone || '—';
    $('rcHours').textContent = c.operating_hours || '—';
    $('rcPricing').textContent = (c.price && c.price.trim()) || c.pricing || '—';
    const webEl = $('rcWebsite');
    if (c.website) {
      webEl.href = c.website;
      webEl.textContent = c.website.replace(/^https?:\/\//, '');
    } else {
      webEl.removeAttribute('href');
      webEl.textContent = '—';
    }

    $('rcDesc').textContent = c.description || '';

    const chipsWrap = $('rcTargetGroups');
    chipsWrap.innerHTML = '';
    const highlightSet = new Set(
      [...state.filters.services, ...m.relationshipMatch, ...m.groupMatch].map((s) => s.toLowerCase())
    );
    const chipLabels = [...new Set([...m.clinicServices, ...m.clinicTargetGroups])];
    chipLabels.forEach((label) => {
      const chip = document.createElement('span');
      chip.className = 'rc-chip';
      if (highlightSet.has(label.toLowerCase())) chip.classList.add('matched');
      chip.textContent = label;
      chipsWrap.appendChild(chip);
    });

    $('rcLicense').innerHTML = m.verified
      ? (vi
          ? `<b>GPHĐ:</b> ${c.license_number}${c.license_issue_date ? ' · cấp ngày ' + c.license_issue_date : ''}`
          : `<b>License:</b> ${c.license_number}${c.license_issue_date ? ' · issued ' + c.license_issue_date : ''}`)
      : (vi ? 'Chưa có thông tin GPHĐ được xác nhận.' : 'No verified license information yet.');

    $('rcAiExplain').textContent = buildExplanation(c, m, m.distanceKm);

    $('resultsProgress').textContent = `${state.currentIndex + 1} / ${state.matches.length}`;
    $('prevClinic').disabled = state.currentIndex === 0;
    $('nextClinic').disabled = state.currentIndex === state.matches.length - 1;

    highlightMarker(c.id);
  }

  const MAPTILER_KEY = '4ryegTLnvRGlcrr8Phnu';

  const TILE_PROVIDERS = [
    {
      url: `https://api.maptiler.com/maps/base-v4/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
      options: {
        attribution:
          '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
        maxZoom: 20,
        tileSize: 512,
        zoomOffset: -1,
      },
    },
    {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      options: {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      },
    },
  ];

  function addResilientTileLayer(map) {
    let switched = false;
    let tileErrorCount = 0;
    const ERROR_THRESHOLD = 3;

    function attach(idx) {
      const provider = TILE_PROVIDERS[idx];
      const layer = L.tileLayer(provider.url, provider.options);
      layer.on('tileerror', () => {
        tileErrorCount++;
        if (!switched && tileErrorCount >= ERROR_THRESHOLD && idx + 1 < TILE_PROVIDERS.length) {
          switched = true;
          console.warn(`Nhiều tile bị lỗi từ provider #${idx} — chuyển sang provider dự phòng.`);
          map.removeLayer(layer);
          attach(idx + 1);
        }
      });
      layer.addTo(map);
    }

    attach(0);
  }

  function initMap() {
    if (state.map) {
      state.map.remove();
      state.map = null;
      state.markers = {};
    }
    state.map = L.map('resultsMap', { scrollWheelZoom: true }).setView(
      [state.refPoint?.lat || FALLBACK_CENTER.lat, state.refPoint?.lng || FALLBACK_CENTER.lng],
      13
    );

    addResilientTileLayer(state.map);

    if (state.refPoint) {
      L.circleMarker([state.refPoint.lat, state.refPoint.lng], {
        radius: 7,
        color: '#4A3B52',
        fillColor: '#4A3B52',
        fillOpacity: 0.9,
        weight: 2,
      })
        .addTo(state.map)
        .bindPopup(state.lang === 'vi' ? 'Vị trí của bạn' : 'Your location');
    }
  }

  function buildMarkerIcon(clinic, active) {
    const type = normType(clinic.clinic_type);
    const pinClass = type === 'public' ? 'pin-public' : type === 'community' ? 'pin-community' : 'pin-private';
    const verified = !!(clinic.license_number && String(clinic.license_number).trim());
    const html = `
      <div class="rm-pin ${pinClass} ${active ? 'pin-active' : ''}" style="position:relative;">
        <i class="fa-solid fa-brain rm-pin-icon"></i>
        ${verified ? '<span class="rm-verified-badge"><i class="fa-solid fa-check"></i></span>' : ''}
      </div>`;
    return L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 30] });
  }

  function renderMarkers() {
    Object.values(state.markers).forEach((mk) => state.map.removeLayer(mk));
    state.markers = {};

    state.matches.forEach((m, idx) => {
      const c = m.clinic;
      if (c.latitude == null || c.longitude == null) return;
      const hasDirectionsLink = !!(c.ggmaps_link && c.ggmaps_link.trim());
      const directionsLine = hasDirectionsLink
        ? `<br><a href="${c.ggmaps_link.trim()}" target="_blank" rel="noopener noreferrer">${state.lang === 'vi' ? 'Chỉ đường →' : 'Directions →'}</a>`
        : '';
      const marker = L.marker([c.latitude, c.longitude], { icon: buildMarkerIcon(c, idx === state.currentIndex) })
        .addTo(state.map)
        .bindPopup(`<div class="rm-popup"><b>${c.clinic_name}</b><br>${c.address || ''}${directionsLine}</div>`);
      marker.on('click', () => {
        state.currentIndex = idx;
        renderCard();
      });
      state.markers[c.id] = marker;
    });
  }

  function highlightMarker(clinicId) {
    Object.entries(state.markers).forEach(([id, marker]) => {
      const c = state.matches.find((m) => String(m.clinic.id) === String(id));
      if (!c) return;
      marker.setIcon(buildMarkerIcon(c.clinic, String(id) === String(clinicId)));
    });
    const active = state.markers[clinicId];
    if (active && state.map) {
      state.map.flyTo(active.getLatLng(), 15, { duration: 0.6 });
      active.openPopup();
    }
  }

  function goPrev() {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderCard();
    }
  }
  function goNext() {
    if (state.currentIndex < state.matches.length - 1) {
      state.currentIndex++;
      renderCard();
    }
  }

  function refreshAll() {
    computeMatches();
    renderHeader();
    renderCard();
    renderMarkers();
  }

  function renderGeoOptions() {
    const sel = $('geoFilterSelect');
    if (!sel) return;
    const vi = state.lang === 'vi';

    const isManualLocation = state.location && state.location.type === 'manual';
    const visibleOptions = GEO_OPTIONS.filter((o) => o.key !== 'ward' || isManualLocation);

    if (!visibleOptions.some((o) => o.key === state.filters.geo)) {
      state.filters.geo = 'nearest';
    }

    sel.innerHTML = visibleOptions.map(
      (o) => `<option value="${o.key}" ${o.key === state.filters.geo ? 'selected' : ''}>${vi ? o.vi : o.en}</option>`
    ).join('');
  }

  function renderTreatmentOptions() {
    const sel = $('treatmentFilterSelect');
    if (!sel) return;
    const vi = state.lang === 'vi';
    sel.innerHTML = TREATMENT_OPTIONS.map(
      (o) => `<option value="${o.key}" ${o.key === state.filters.treatment ? 'selected' : ''}>${vi ? o.vi : o.en}</option>`
    ).join('');
  }

  function renderTypeOptions() {
    const sel = $('typeFilterSelect');
    if (!sel) return;
    const vi = state.lang === 'vi';

    const types = [...new Set(
      state.clinics.map((c) => (c.clinic_type || '').trim()).filter(Boolean)
    )].sort();

    if (state.filters.type && !types.includes(state.filters.type)) {
      state.filters.type = '';
    }

    sel.innerHTML =
      `<option value="">${vi ? 'Tất cả loại hình' : 'All types'}</option>` +
      types.map(
        (t) => `<option value="${t.replace(/"/g, '&quot;')}" ${t === state.filters.type ? 'selected' : ''}>${t}</option>`
      ).join('');
  }

  function updateServiceFilterBtnLabel() {
    const btn = $('serviceFilterBtn');
    if (!btn) return;
    const vi = state.lang === 'vi';
    const n = state.filters.services.length;
    btn.textContent = n
      ? (vi ? `${n} dịch vụ đã chọn` : `${n} services selected`)
      : (vi ? 'Tất cả dịch vụ' : 'All services');
  }

  function renderServicePanel() {
    const panel = $('serviceFilterPanel');
    if (!panel) return;
    const vi = state.lang === 'vi';
    panel.innerHTML = `
      <div class="service-filter-list">
        ${SERVICE_OPTIONS.map((o, i) => `
          <label class="service-filter-item">
            <input type="checkbox" data-service="${o.vi}" ${state.filters.services.includes(o.vi) ? 'checked' : ''}>
            <span>${vi ? o.vi : o.en}</span>
          </label>
        `).join('')}
      </div>
      <div class="service-filter-actions">
        <button type="button" id="serviceFilterClear">${vi ? 'Bỏ chọn hết' : 'Clear all'}</button>
        <button type="button" id="serviceFilterApply">${vi ? 'Áp dụng' : 'Apply'}</button>
      </div>
    `;

    panel.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const label = cb.dataset.service;
        if (cb.checked) {
          if (!state.filters.services.includes(label)) state.filters.services.push(label);
        } else {
          state.filters.services = state.filters.services.filter((s) => s !== label);
        }
      });
    });

    const clearBtn = $('serviceFilterClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        state.filters.services = [];
        renderServicePanel();
        updateServiceFilterBtnLabel();
      });
    }
    const applyBtn = $('serviceFilterApply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        panel.classList.add('hidden');
        updateServiceFilterBtnLabel();
        refreshAll();
      });
    }
  }

  function bindFilterEvents() {
    const geoSel = $('geoFilterSelect');
    if (geoSel) {
      geoSel.addEventListener('change', () => {
        state.filters.geo = geoSel.value;
        refreshAll();
      });
    }

    const treatmentSel = $('treatmentFilterSelect');
    if (treatmentSel) {
      treatmentSel.addEventListener('change', () => {
        state.filters.treatment = treatmentSel.value;
        refreshAll();
      });
    }

    const typeSel = $('typeFilterSelect');
    if (typeSel) {
      typeSel.addEventListener('change', () => {
        state.filters.type = typeSel.value;
        refreshAll();
      });
    }

    const serviceBtn = $('serviceFilterBtn');
    const servicePanel = $('serviceFilterPanel');
    if (serviceBtn && servicePanel) {
      serviceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        servicePanel.classList.toggle('hidden');
      });
      document.addEventListener('click', (e) => {
        if (!servicePanel.contains(e.target) && e.target !== serviceBtn) {
          servicePanel.classList.add('hidden');
        }
      });
    }
  }

  function setupFilterUI() {
    renderGeoOptions();
    renderTreatmentOptions();
    renderTypeOptions();
    renderServicePanel();
    updateServiceFilterBtnLabel();
    bindFilterEvents();
  }

  function setLang(lang) {
    state.lang = lang;
    document.body.setAttribute('data-lang', lang);
    $('viBtn').classList.toggle('active', lang === 'vi');
    $('enBtn').classList.toggle('active', lang === 'en');
    renderGeoOptions();
    renderTreatmentOptions();
    renderTypeOptions();
    renderServicePanel();
    updateServiceFilterBtnLabel();
    renderHeader();
    if (state.matches.length) renderCard();
  }

  let bound = false;

  async function init() {
    if (!loadWizardData()) return;

    if (state.recommendation && state.recommendation.redFlag) {
      showEmergencyState();
      return;
    }

    if (!bound) {
      bound = true;
      $('backHomeBtn')?.addEventListener('click', () => {
        if (typeof showPage === 'function') showPage('home');
        else window.location.href = 'index.html';
      });
      $('viBtn').addEventListener('click', () => setLang('vi'));
      $('enBtn').addEventListener('click', () => setLang('en'));
      $('prevClinic').addEventListener('click', goPrev);
      $('nextClinic').addEventListener('click', goNext);
      setupFilterUI();
    }

    $('resultsLoading').classList.remove('hidden');
    $('resultsCard').classList.add('hidden');
    $('resultsEmpty').classList.add('hidden');

    const [refPoint, clinics] = await Promise.all([getReferencePoint(), loadClinics()]);
    state.refPoint = refPoint;
    state.clinics = clinics;

    renderTypeOptions();

    await resolveUserLocationLabels();

    initMap();
    refreshAll();

    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, 100);
  }

  window.PsyMapResults = { init };
})();