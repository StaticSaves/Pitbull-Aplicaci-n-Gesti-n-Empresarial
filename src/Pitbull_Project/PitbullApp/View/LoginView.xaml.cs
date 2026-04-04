using System;
using System.Windows;
using MySql.Data.MySqlClient;  // para encontrar la clase conexion de la base de datos
using PitbullApp.Datos; 
using PitbullApp.Helpers; // para encontrar al encriptador

namespace PitbullApp.View
{
    public partial class LoginView : Window
    {
        public LoginView()
        {
            InitializeComponent();
        }

        private void btnLogin_Click(object sender, RoutedEventArgs e)
        {
            string usuarioInput = txtUsuario.Text;
            string passwordInput = txtPassword.Password;

            if (string.IsNullOrEmpty(usuarioInput) || string.IsNullOrEmpty(passwordInput))
            {
                MessageBox.Show("Por favor, llenar todos los campos.");
                return;
            }

            ValidarAcceso(usuarioInput, passwordInput);
        }

        private void ValidarAcceso(string user, string pass)
        {
            try 
            {
                using (MySqlConnection con = Conexion.ObtenerConexion())
                {
                    if (con == null) 
                    {
                        MessageBox.Show("No se pudo establecer conexión.");
                        return;
                    }

                    // Busca el hash del usuario
                    string sql = "SELECT PasswordHash FROM usuario WHERE NombreUsuario = @user AND Estado = 1";
                    MySqlCommand cmd = new MySqlCommand(sql, con);
                    cmd.Parameters.AddWithValue("@user", user);

                    object? resultado = cmd.ExecuteScalar();
                    // Se cuestiona si el usuario existe
                    if (resultado != null)
                    {
                        string hashDB = resultado.ToString()!.Trim(); // trim quita los espacion invicibles

                        // Se cuestiona si la contraseña coincide
                        if (Encriptador.VerificarPassword(pass, hashDB))
                        {
                            MessageBox.Show("¡Bienvenido al Sistema!");
                            
                            // Abre la ventana principal y cerrar el login
                            MainWindow principal = new MainWindow();
                            principal.Show();
                            this.Close(); 
                        }
                        else
                        {
                            MessageBox.Show("Contraseña Incorrecta.");
                        }
                    }
                    else
                    {
                        MessageBox.Show("El Usuario no existe o está Inactivo.");
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error técnico: " + ex.Message);
            }
        }
    }
}
