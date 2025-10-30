// ========================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ========================================

const API_URL = 'https://script.google.com/macros/s/AKfycby-CT0YBSE2n3Iy6Pf5XTFbpJZGSx1en6FWKdENXjVR9GflsCnzgTS08Kb9iw5ydBq1/exec';
const STORAGE_KEY = 'wimpyapp_user';
const ADMIN_SESSION_KEY = 'wimpyapp_admin_session';
const CART_KEY = 'wimpyapp_cart';

let currentUser = null;
let adminSession = null;
let currentCart = [];
let products = [];
let clients = [];
let enterprises = [];
let configuration = {};
let userPoints = 0;
let userOrders = [];

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // Verificar si hay sesión de cliente
    const savedUser = localStorage.getItem(STORAGE_KEY);
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showScreen('clientDashboardScreen');
        loadClientData();
    } else {
        // Verificar si hay sesión de administrador
        const savedAdminSession = sessionStorage.getItem(ADMIN_SESSION_KEY);
        if (savedAdminSession) {
            adminSession = JSON.parse(savedAdminSession);
            showScreen('adminDashboardScreen');
            loadAdminData();
        } else {
            showScreen('homeScreen');
        }
    }

    // Cargar carrito
    const savedCart = localStorage.getItem(CART_KEY);
    if (savedCart) {
        currentCart = JSON.parse(savedCart);
        updateCartBadge();
    }
}

// ========================================
// GESTIÓN DE PANTALLAS
// ========================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function goHome() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    currentUser = null;
    adminSession = null;
    showScreen('homeScreen');
}

function goToClientLogin() {
    showScreen('clientLoginScreen');
}

function goToAdminLogin() {
    showScreen('adminLoginScreen');
}

// ========================================
// NAVEGACIÓN DE TABS
// ========================================

function switchClientTab(tabName) {
    document.querySelectorAll('#clientDashboardScreen .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('#clientDashboardScreen .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(tabName + 'Tab').classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'points') {
        loadPointsData();
    } else if (tabName === 'orders') {
        loadOrdersData();
    } else if (tabName === 'catalog') {
        loadProducts();
    }
}

function switchAdminTab(tabName) {
    document.querySelectorAll('#adminDashboardScreen .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('#adminDashboardScreen .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(tabName + 'Tab').classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'config') {
        loadConfigurationForm();
    } else if (tabName === 'clients') {
        loadClientsTable();
    } else if (tabName === 'products') {
        loadProductsTable();
    } else if (tabName === 'enterprises') {
        loadEnterprisesTable();
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Cliente - Login
    document.getElementById('clientPhoneForm').addEventListener('submit', handleClientPhoneSubmit);
    document.getElementById('clientPasswordForm').addEventListener('submit', handleClientPasswordSubmit);
    document.getElementById('requestPasswordForm').addEventListener('submit', handleRequestPassword);
    document.getElementById('pinForm').addEventListener('submit', handlePinSubmit);
    document.getElementById('createPasswordForm').addEventListener('submit', handleCreatePassword);

    // Cliente - Búsqueda
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Administrador - Login
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);

    // Modales
    document.getElementById('createClientForm').addEventListener('submit', (e) => e.preventDefault());
    document.getElementById('createProductForm').addEventListener('submit', (e) => e.preventDefault());
    document.getElementById('createEnterpriseForm').addEventListener('submit', (e) => e.preventDefault());
}

// ========================================
// AUTENTICACIÓN - CLIENTE
// ========================================

async function handleClientPhoneSubmit(e) {
    e.preventDefault();
    const phone = document.getElementById('clientPhone').value.trim();

    if (!validatePhone(phone)) {
        showNotification('Por favor ingresa un número de teléfono válido', 'error');
        return;
    }

    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=checkUser&phone=${phone}`);
        const data = await response.json();

        if (data.success) {
            if (data.result.isNewUser) {
                // Usuario no existe
                document.getElementById('notFoundPhone').textContent = phone;
                showScreen('clientNotFoundScreen');
            } else if (!data.result.tiene_contraseña) {
                // Usuario existe pero sin contraseña
                document.getElementById('clientPhoneHidden').value = phone;
                showScreen('clientNoPasswordScreen');
            } else {
                // Usuario existe con contraseña
                document.getElementById('clientPhoneHiddenPassword').value = phone;
                showScreen('clientPasswordScreen');
            }
        } else {
            showNotification(data.message || 'Error al verificar usuario', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error de conexión. Intenta de nuevo.', 'error');
    } finally {
        showLoadingState(false);
    }
}

async function handleRequestPassword(e) {
    e.preventDefault();
    const phone = document.getElementById('clientPhoneHidden').value;

    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=requestPassword`, {
            method: 'POST',
            body: JSON.stringify({ phone })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('phoneForPin').value = phone;
            showNotification('Código enviado a tu correo', 'success');
            showScreen('pinVerificationScreen');
        } else {
            showNotification(data.message || 'Error al solicitar código', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error de conexión', 'error');
    } finally {
        showLoadingState(false);
    }
}

async function handlePinSubmit(e) {
    e.preventDefault();
    const pin = document.getElementById('pinInput').value;
    const phone = document.getElementById('phoneForPin').value;

    if (!pin || pin.length !== 6) {
        showNotification('Por favor ingresa un PIN válido de 6 dígitos', 'error');
        return;
    }

    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=verifyPin`, {
            method: 'POST',
            body: JSON.stringify({ phone, pin })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('phoneForPassword').value = phone;
            showScreen('createPasswordScreen');
        } else {
            showNotification(data.message || 'PIN inválido', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al verificar PIN', 'error');
    } finally {
        showLoadingState(false);
    }
}

async function handleCreatePassword(e) {
    e.preventDefault();
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const phone = document.getElementById('phoneForPassword').value;

    if (password !== confirmPassword) {
        showNotification('Las contraseñas no coinciden', 'error');
        return;
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
        showNotification('La contraseña debe ser 4 dígitos numéricos', 'error');
        return;
    }

    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=createPassword`, {
            method: 'POST',
            body: JSON.stringify({ phone, password })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = {
                phone,
                email: data.result.email,
                createdAt: new Date().toISOString()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
            showNotification('¡Contraseña creada exitosamente!', 'success');
            setTimeout(() => {
                showScreen('clientDashboardScreen');
                loadClientData();
            }, 1500);
        } else {
            showNotification(data.message || 'Error al crear contraseña', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al crear contraseña', 'error');
    } finally {
        showLoadingState(false);
    }
}

async function handleClientPasswordSubmit(e) {
    e.preventDefault();
    const password = document.getElementById('clientPassword').value;
    const phone = document.getElementById('clientPhoneHiddenPassword').value;

    if (!password || password.length !== 4) {
        showNotification('Por favor ingresa una contraseña válida', 'error');
        return;
    }

    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=loginPassword`, {
            method: 'POST',
            body: JSON.stringify({ phone, password })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = {
                phone,
                email: data.result.email,
                createdAt: data.result.createdAt
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
            showNotification('¡Bienvenido!', 'success');
            setTimeout(() => {
                showScreen('clientDashboardScreen');
                loadClientData();
            }, 1000);
        } else {
            showNotification(data.message || 'Contraseña incorrecta', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al iniciar sesión', 'error');
    } finally {
        showLoadingState(false);
    }
}

function handleForgotPassword() {
    const phone = document.getElementById('clientPhoneHiddenPassword').value;
    if (phone) {
        document.getElementById('phoneForPin').value = phone;
        showScreen('pinVerificationScreen');
        showNotification('Se envió un nuevo PIN a tu correo', 'info');
    }
}

function resendPin() {
    showNotification('PIN reenviado a tu correo', 'info');
}

function handleClientLogout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        localStorage.removeItem(STORAGE_KEY);
        currentUser = null;
        currentCart = [];
        showScreen('homeScreen');
        showNotification('Sesión cerrada', 'info');
    }
}

// ========================================
// AUTENTICACIÓN - ADMINISTRADOR
// ========================================

async function handleAdminLogin(e) {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;

    if (!password) {
        showNotification('Por favor ingresa la contraseña', 'error');
        return;
    }

    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=verifyAdminPassword`, {
            method: 'POST',
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            adminSession = {
                token: data.result.token,
                createdAt: new Date().toISOString()
            };
            sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminSession));
            showNotification('¡Bienvenido Administrador!', 'success');
            setTimeout(() => {
                showScreen('adminDashboardScreen');
                loadAdminData();
            }, 1000);
        } else {
            showNotification(data.message || 'Contraseña incorrecta', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al iniciar sesión', 'error');
    } finally {
        showLoadingState(false);
    }
}

function handleAdminLogout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        adminSession = null;
        showScreen('homeScreen');
        showNotification('Sesión de administrador cerrada', 'info');
    }
}

// ========================================
// GESTIÓN DE PRODUCTOS
// ========================================

async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}?action=getProducts`);
        const data = await response.json();

        if (data.success) {
            products = data.result.products || [];
            renderProducts(products);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        products = [
            { id: '1', name: 'Hamburguesa Clásica', category: 'hamburguesas', price: 15000, emoji: '🍔', da_puntos: true },
            { id: '2', name: 'Hamburguesa Especial', category: 'hamburguesas', price: 18000, emoji: '🍔', da_puntos: true },
            { id: '3', name: 'Almuerzo Ejecutivo', category: 'almuerzos', price: 12000, emoji: '🍽️', da_puntos: false },
            { id: '4', name: 'Bebida Refrescante', category: 'bebidas', price: 3000, emoji: '🥤', da_puntos: true },
            { id: '5', name: 'Postre Delicioso', category: 'postres', price: 5000, emoji: '🍰', da_puntos: true }
        ];
        renderProducts(products);
    }
}

function renderProducts(productsToShow = products) {
    const container = document.getElementById('productsList');
    container.innerHTML = '';

    if (productsToShow.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay productos disponibles</p></div>';
        return;
    }

    productsToShow.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-image">${product.emoji || '📦'}</div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-category">${product.category}</div>
                <div class="product-price">$${formatPrice(product.price)}</div>
                <div class="product-actions">
                    <button class="btn btn-primary" onclick="addToCart('${product.id}', '${product.name}', ${product.price}, ${product.da_puntos})">
                        <i class="fas fa-plus"></i> Agregar
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

async function loadProductsTable() {
    try {
        const response = await fetch(`${API_URL}?action=getProducts`);
        const data = await response.json();

        if (data.success) {
            products = data.result.products || [];
            renderProductsTable();
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function renderProductsTable() {
    const container = document.getElementById('productsTable');
    if (products.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay productos registrados</p>';
        return;
    }

    let html = '<table class="admin-table"><thead><tr><th>Nombre</th><th>Precio</th><th>Categoría</th><th>Da Puntos</th><th>Activo</th><th>Acciones</th></tr></thead><tbody>';
    products.forEach(product => {
        html += `<tr>
            <td>${product.name}</td>
            <td>$${formatPrice(product.price)}</td>
            <td>${product.category}</td>
            <td>${product.da_puntos ? 'Sí' : 'No'}</td>
            <td>${product.activo ? 'Sí' : 'No'}</td>
            <td>
                <button class="btn btn-sm" onclick="editProduct('${product.id}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.id}')">Eliminar</button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
    renderProducts(filtered);
}

// ========================================
// GESTIÓN DEL CARRITO
// ========================================

function addToCart(productId, productName, price, daPuntos) {
    const existingItem = currentCart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        currentCart.push({
            id: productId,
            name: productName,
            price,
            daPuntos,
            quantity: 1
        });
    }

    saveCart();
    updateCartBadge();
    showNotification(`${productName} agregado al carrito`, 'success');
}

function removeFromCart(productId) {
    currentCart = currentCart.filter(item => item.id !== productId);
    saveCart();
    updateCartBadge();
    renderCart();
}

function updateQuantity(productId, quantity) {
    const item = currentCart.find(item => item.id === productId);
    if (item) {
        item.quantity = Math.max(1, quantity);
        saveCart();
        updateCartBadge();
        renderCart();
    }
}

function renderCart() {
    const cartContent = document.getElementById('cartContent');
    const cartEmpty = document.getElementById('cartEmpty');
    const cartItems = document.getElementById('cartItems');

    if (currentCart.length === 0) {
        cartContent.style.display = 'none';
        cartEmpty.style.display = 'flex';
        return;
    }

    cartContent.style.display = 'block';
    cartEmpty.style.display = 'none';

    cartItems.innerHTML = '';
    let subtotal = 0;

    currentCart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">$${formatPrice(item.price)} c/u</div>
            </div>
            <div class="cart-item-controls">
                <div class="quantity-control">
                    <button onclick="updateQuantity('${item.id}', ${item.quantity - 1})">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
                </div>
                <div class="cart-item-total">$${formatPrice(itemTotal)}</div>
                <button class="btn-icon" onclick="removeFromCart('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        cartItems.appendChild(cartItem);
    });

    const discount = 0;
    const total = subtotal - discount;

    document.getElementById('subtotal').textContent = `$${formatPrice(subtotal)}`;
    document.getElementById('discount').textContent = `$${formatPrice(discount)}`;
    document.getElementById('total').textContent = `$${formatPrice(total)}`;
}

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(currentCart));
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const totalItems = currentCart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = totalItems;
}

// ========================================
// PEDIDOS
// ========================================

function openOrderConfirmModal() {
    if (currentCart.length === 0) {
        showNotification('Tu carrito está vacío', 'warning');
        return;
    }

    const modal = document.getElementById('orderConfirmModal');
    const summary = document.getElementById('orderSummary');

    let subtotal = 0;
    summary.innerHTML = '';

    currentCart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        const summaryItem = document.createElement('div');
        summaryItem.className = 'order-summary-item';
        summaryItem.innerHTML = `
            <span>${item.name} x${item.quantity}</span>
            <span>$${formatPrice(itemTotal)}</span>
        `;
        summary.appendChild(summaryItem);
    });

    const totalItem = document.createElement('div');
    totalItem.className = 'order-summary-item';
    totalItem.innerHTML = `
        <span>Total</span>
        <span>$${formatPrice(subtotal)}</span>
    `;
    summary.appendChild(totalItem);

    document.getElementById('pointsToUse').value = 0;
    document.getElementById('pointsDiscountInfo').textContent = '';

    modal.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function calculatePointsDiscount() {
    const pointsToUse = parseInt(document.getElementById('pointsToUse').value) || 0;
    
    if (pointsToUse > userPoints) {
        showNotification(`No tienes suficientes puntos. Disponibles: ${userPoints}`, 'error');
        document.getElementById('pointsToUse').value = userPoints;
        return;
    }

    const discount = pointsToUse * (configuration.tasa_descuento_puntos || 1);
    document.getElementById('pointsDiscountInfo').textContent = `Descuento: $${formatPrice(discount)}`;
    document.getElementById('discount').textContent = `$${formatPrice(discount)}`;

    // Recalcular total
    let subtotal = 0;
    currentCart.forEach(item => {
        subtotal += item.price * item.quantity;
    });
    const total = subtotal - discount;
    document.getElementById('total').textContent = `$${formatPrice(total)}`;
}

async function handleOrderSubmit() {
    if (currentCart.length === 0) {
        showNotification('Tu carrito está vacío', 'warning');
        return;
    }

    const notes = document.getElementById('deliveryNotes').value;
    const pointsToUse = parseInt(document.getElementById('pointsToUse').value) || 0;

    try {
        showLoadingState(true);

        const response = await fetch(`${API_URL}?action=createOrder`, {
            method: 'POST',
            body: JSON.stringify({
                phone: currentUser.phone,
                items: currentCart,
                notes,
                pointsToUse,
                timestamp: new Date().toISOString()
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('¡Pedido confirmado! Pronto lo recibirás', 'success');
            currentCart = [];
            saveCart();
            updateCartBadge();
            closeModal('orderConfirmModal');
            document.getElementById('deliveryNotes').value = '';
            switchClientTab('orders');
            loadOrdersData();
        } else {
            showNotification(data.message || 'Error al crear el pedido', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al crear el pedido', 'error');
    } finally {
        showLoadingState(false);
    }
}

async function loadOrdersData() {
    try {
        const response = await fetch(`${API_URL}?action=getUserOrders&phone=${currentUser.phone}`);
        const data = await response.json();

        if (data.success) {
            userOrders = data.result.orders || [];
            renderOrders();
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderOrders() {
    const container = document.getElementById('ordersList');
    const emptyState = document.getElementById('ordersEmpty');

    if (userOrders.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }

    container.style.display = 'flex';
    emptyState.style.display = 'none';
    container.innerHTML = '';

    userOrders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';
        const statusClass = order.status.toLowerCase();
        card.innerHTML = `
            <div class="order-header">
                <div class="order-id">Pedido #${order.id}</div>
                <div class="order-status ${statusClass}">${order.status}</div>
            </div>
            <div class="order-details">
                <span>${new Date(order.timestamp).toLocaleDateString()}</span>
                <span class="order-total">$${formatPrice(order.total)}</span>
            </div>
            ${!order.confirmacion_cliente ? `
                <button class="btn btn-sm btn-primary" style="margin-top: 12px; width: 100%;" onclick="confirmOrderReceipt('${order.id}')">
                    <i class="fas fa-check"></i> Confirmar Recepción
                </button>
            ` : `
                <div style="margin-top: 12px; color: var(--color-success); font-size: 12px;">
                    <i class="fas fa-check-circle"></i> Recibido el ${new Date(order.confirmacion_cliente).toLocaleDateString()}
                </div>
            `}
        `;
        container.appendChild(card);
    });
}

async function confirmOrderReceipt(orderId) {
    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=confirmOrderReceipt`, {
            method: 'POST',
            body: JSON.stringify({
                orderId,
                phone: currentUser.phone
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Recepción confirmada', 'success');
            loadOrdersData();
        } else {
            showNotification(data.message || 'Error al confirmar recepción', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al confirmar recepción', 'error');
    } finally {
        showLoadingState(false);
    }
}

// ========================================
// PUNTOS Y FIDELIZACIÓN
// ========================================

async function loadPointsData() {
    try {
        const response = await fetch(`${API_URL}?action=getUserPoints&phone=${currentUser.phone}`);
        const data = await response.json();

        if (data.success) {
            userPoints = data.result.points || 0;
            document.getElementById('pointsBalance').textContent = userPoints;

            if (data.result.history) {
                renderPointsHistory(data.result.history);
            }
        }
    } catch (error) {
        console.error('Error loading points:', error);
    }
}

function renderPointsHistory(history) {
    const container = document.getElementById('pointsHistoryList');
    container.innerHTML = '';

    if (history.length === 0) {
        container.innerHTML = '<p class="text-muted">Sin historial de puntos</p>';
        return;
    }

    history.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'history-item';
        const isNegative = entry.puntos < 0;
        item.innerHTML = `
            <div>
                <div>${entry.descripcion}</div>
                <div class="history-item-date">${new Date(entry.fecha).toLocaleDateString()}</div>
            </div>
            <div class="history-item-points ${isNegative ? 'negative' : ''}">
                ${isNegative ? '' : '+'}${entry.puntos}
            </div>
        `;
        container.appendChild(item);
    });
}

async function loadClientData() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_URL}?action=getUserData&phone=${currentUser.phone}`);
        const data = await response.json();

        if (data.success) {
            userPoints = data.result.points || 0;
            userOrders = data.result.orders || [];
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }

    loadProducts();
}

// ========================================
// ADMINISTRACIÓN - CONFIGURACIÓN
// ========================================

async function loadConfiguration() {
    try {
        const response = await fetch(`${API_URL}?action=getConfiguration`);
        const data = await response.json();

        if (data.success) {
            configuration = data.result.config || {};
        }
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
}

async function loadConfigurationForm() {
    await loadConfiguration();

    const container = document.getElementById('configForm');
    container.innerHTML = '';

    const configFields = [
        { key: 'admin_email', label: 'Email del Administrador', type: 'email' },
        { key: 'admin_whatsapp', label: 'WhatsApp del Administrador', type: 'tel' },
        { key: 'puntos_por_mil', label: 'Puntos por cada $1000', type: 'number' },
        { key: 'tasa_descuento_puntos', label: 'Pesos de descuento por punto', type: 'number' },
        { key: 'nombre_restaurante', label: 'Nombre del Restaurante', type: 'text' },
        { key: 'email_soporte', label: 'Email de Soporte', type: 'email' },
        { key: 'telefono_soporte', label: 'Teléfono de Soporte', type: 'tel' }
    ];

    configFields.forEach(field => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        formGroup.innerHTML = `
            <label>${field.label}</label>
            <input type="${field.type}" id="config_${field.key}" value="${configuration[field.key] || ''}" required>
        `;
        container.appendChild(formGroup);
    });

    const button = document.createElement('button');
    button.className = 'btn btn-primary btn-block';
    button.textContent = 'Guardar Configuración';
    button.onclick = saveConfiguration;
    container.appendChild(button);
}

async function saveConfiguration() {
    const configFields = [
        'admin_email', 'admin_whatsapp', 'puntos_por_mil', 'tasa_descuento_puntos',
        'nombre_restaurante', 'email_soporte', 'telefono_soporte'
    ];

    const updates = {};
    configFields.forEach(field => {
        updates[field] = document.getElementById(`config_${field}`).value;
    });

    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=updateConfiguration`, {
            method: 'POST',
            body: JSON.stringify(updates)
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Configuración guardada', 'success');
            await loadConfiguration();
        } else {
            showNotification(data.message || 'Error al guardar configuración', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al guardar configuración', 'error');
    } finally {
        showLoadingState(false);
    }
}

// ========================================
// ADMINISTRACIÓN - CLIENTES
// ========================================

async function loadClientsTable() {
    try {
        const response = await fetch(`${API_URL}?action=listClients`);
        const data = await response.json();

        if (data.success) {
            clients = data.result.clients || [];
            renderClientsTable();
        }
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

function renderClientsTable() {
    const container = document.getElementById('clientsTable');
    if (clients.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay clientes registrados</p>';
        return;
    }

    let html = '<table class="admin-table"><thead><tr><th>Teléfono</th><th>Email</th><th>Empresa</th><th>Tiene Contraseña</th><th>Acciones</th></tr></thead><tbody>';
    clients.forEach(client => {
        html += `<tr>
            <td>${client.telefono}</td>
            <td>${client.email}</td>
            <td>${client.empresa_id || '-'}</td>
            <td>${client.tiene_contraseña ? 'Sí' : 'No'}</td>
            <td>
                <button class="btn btn-sm" onclick="editClient('${client.id}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="deleteClient('${client.id}')">Eliminar</button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openCreateClientModal() {
    loadEnterprisesForSelect('newClientEnterprise');
    document.getElementById('createClientForm').reset();
    document.getElementById('createClientModal').classList.add('active');
}

async function loadEnterprisesForSelect(selectId) {
    try {
        const response = await fetch(`${API_URL}?action=listEnterprises`);
        const data = await response.json();

        if (data.success) {
            enterprises = data.result.enterprises || [];
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Selecciona una empresa</option>';
            enterprises.forEach(ent => {
                const option = document.createElement('option');
                option.value = ent.id;
                option.textContent = ent.nombre;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading enterprises:', error);
    }
}

async function submitCreateClient() {
    const phone = document.getElementById('newClientPhone').value;
    const email = document.getElementById('newClientEmail').value;
    const enterpriseId = document.getElementById('newClientEnterprise').value;

    if (!phone || !email || !enterpriseId) {
        showNotification('Por favor completa todos los campos', 'error');
        return;
    }

    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=createClient`, {
            method: 'POST',
            body: JSON.stringify({ phone, email, enterprise_id: enterpriseId })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Cliente creado exitosamente', 'success');
            closeModal('createClientModal');
            loadClientsTable();
        } else {
            showNotification(data.message || 'Error al crear cliente', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al crear cliente', 'error');
    } finally {
        showLoadingState(false);
    }
}

// ========================================
// ADMINISTRACIÓN - EMPRESAS
// ========================================

async function loadEnterprisesTable() {
    try {
        const response = await fetch(`${API_URL}?action=listEnterprises`);
        const data = await response.json();

        if (data.success) {
            enterprises = data.result.enterprises || [];
            renderEnterprisesTable();
        }
    } catch (error) {
        console.error('Error loading enterprises:', error);
    }
}

function renderEnterprisesTable() {
    const container = document.getElementById('enterprisesTable');
    if (enterprises.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay empresas registradas</p>';
        return;
    }

    let html = '<table class="admin-table"><thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>NIT</th><th>Acciones</th></tr></thead><tbody>';
    enterprises.forEach(ent => {
        html += `<tr>
            <td>${ent.nombre}</td>
            <td>${ent.email}</td>
            <td>${ent.telefono}</td>
            <td>${ent.nit}</td>
            <td>
                <button class="btn btn-sm" onclick="editEnterprise('${ent.id}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="deleteEnterprise('${ent.id}')">Eliminar</button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function openCreateEnterpriseModal() {
    document.getElementById('createEnterpriseForm').reset();
    document.getElementById('createEnterpriseModal').classList.add('active');
}

async function submitCreateEnterprise() {
    const name = document.getElementById('newEnterpriseName').value;
    const email = document.getElementById('newEnterpriseEmail').value;
    const phone = document.getElementById('newEnterprisePhone').value;
    const address = document.getElementById('newEnterpriseAddress').value;
    const nit = document.getElementById('newEnterpriseNIT').value;

    if (!name || !email || !phone || !address || !nit) {
        showNotification('Por favor completa todos los campos', 'error');
        return;
    }

    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=createEnterprise`, {
            method: 'POST',
            body: JSON.stringify({ name, email, phone, address, nit })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Empresa creada exitosamente', 'success');
            closeModal('createEnterpriseModal');
            loadEnterprisesTable();
        } else {
            showNotification(data.message || 'Error al crear empresa', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al crear empresa', 'error');
    } finally {
        showLoadingState(false);
    }
}

// ========================================
// ADMINISTRACIÓN - PRODUCTOS
// ========================================

function openCreateProductModal() {
    document.getElementById('createProductForm').reset();
    document.getElementById('createProductModal').classList.add('active');
}

async function submitCreateProduct() {
    const name = document.getElementById('newProductName').value;
    const price = document.getElementById('newProductPrice').value;
    const category = document.getElementById('newProductCategory').value;
    const emoji = document.getElementById('newProductEmoji').value;
    const daPuntos = document.getElementById('newProductDaPoints').checked;

    if (!name || !price || !category || !emoji) {
        showNotification('Por favor completa todos los campos', 'error');
        return;
    }

    try {
        showLoadingState(true);
        const response = await fetch(`${API_URL}?action=createProduct`, {
            method: 'POST',
            body: JSON.stringify({ name, price: parseInt(price), category, emoji, da_puntos: daPuntos })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Producto creado exitosamente', 'success');
            closeModal('createProductModal');
            loadProductsTable();
        } else {
            showNotification(data.message || 'Error al crear producto', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al crear producto', 'error');
    } finally {
        showLoadingState(false);
    }
}

// ========================================
// ADMINISTRACIÓN - DATOS GENERALES
// ========================================

async function loadAdminData() {
    await loadConfiguration();
    await loadClientsTable();
    await loadProductsTable();
    await loadEnterprisesTable();
}

// ========================================
// UTILIDADES
// ========================================

function validatePhone(phone) {
    return /^\d{7,}$/.test(phone.replace(/\D/g, ''));
}

function formatPrice(price) {
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    notification.innerHTML = `
        <i class="fas ${iconMap[type]}"></i>
        <div class="notification-message">
            <p>${message}</p>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function showLoadingState(isLoading) {
    console.log('Loading:', isLoading);
}

// Hacer funciones globales disponibles
window.goHome = goHome;
window.goToClientLogin = goToClientLogin;
window.goToAdminLogin = goToAdminLogin;
window.switchClientTab = switchClientTab;
window.switchAdminTab = switchAdminTab;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.openOrderConfirmModal = openOrderConfirmModal;
window.closeModal = closeModal;
window.calculatePointsDiscount = calculatePointsDiscount;
window.handleOrderSubmit = handleOrderSubmit;
window.confirmOrderReceipt = confirmOrderReceipt;
window.handleClientLogout = handleClientLogout;
window.handleAdminLogout = handleAdminLogout;
window.handleSearch = handleSearch;
window.resendPin = resendPin;
window.handleForgotPassword = handleForgotPassword;
window.openCreateClientModal = openCreateClientModal;
window.openCreateProductModal = openCreateProductModal;
window.openCreateEnterpriseModal = openCreateEnterpriseModal;
window.submitCreateClient = submitCreateClient;
window.submitCreateProduct = submitCreateProduct;
window.submitCreateEnterprise = submitCreateEnterprise;
window.showNotification = showNotification;

