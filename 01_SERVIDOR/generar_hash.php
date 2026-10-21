<?php

$password = 'pitbull123';

echo "<h1>Hash generado</h1>";
echo "<p><strong>Contraseña:</strong> " . htmlspecialchars($password) . "</p>";
echo "<p><strong>Hash (copia esto):</strong></p>";
echo "<pre style='background:#f0f0f0;padding:10px;border:1px solid #ccc'>";
echo password_hash($password, PASSWORD_DEFAULT);
echo "</pre>";
