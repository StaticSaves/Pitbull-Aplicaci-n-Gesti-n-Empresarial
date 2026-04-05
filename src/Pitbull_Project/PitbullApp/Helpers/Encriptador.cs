using BCrypt.Net;

namespace PitbullApp.Helpers
{

    public class Encriptador
    {

        // Convertidor de 1234 a un Hash seguro

        public static string
        EncriptarPassword(string password)
        {
            return BCrypt.Net.BCrypt.HashPassword(password);
        }

        // verificar si la clave que el usuario escribe coincide con el Hash de la Base de datos

        public static bool
        VerificarPassword(string password, string hash)
        {
            return BCrypt.Net.BCrypt.Verify(password,hash);
        }
        
    }
    
}